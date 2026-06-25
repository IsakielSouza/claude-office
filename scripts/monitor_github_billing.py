#!/usr/bin/env python3
"""
monitor_github_billing.py — Monitor GitHub Actions billing status

Monitors GitHub Actions billing to detect if access has been suspended.
Can be run as a cron job every 30 minutes to alert on billing issues.

Usage:
  python3 scripts/monitor_github_billing.py \
    --org ORGANIZATION \
    --token GITHUB_TOKEN \
    [--slack-webhook SLACK_WEBHOOK_URL]

Environment:
  GITHUB_TOKEN           GitHub personal access token with 'admin:org_hook' scope
  GITHUB_ORG             Organization to monitor
  SLACK_WEBHOOK_URL      (Optional) Slack webhook for notifications

Reference:
  - GitHub Billing API: https://docs.github.com/en/rest/billing
  - Issue #954: GitHub billing was suspended silently, CI/CD broke for 3 days
"""

import argparse
import json
import os
import sys
from datetime import datetime
from pathlib import Path
from typing import Optional, Dict, Any

try:
    import requests
except ImportError:
    print("Error: requests library not found. Install with: pip install requests", file=sys.stderr)
    sys.exit(1)


class GitHubBillingMonitor:
    """Monitor GitHub Actions billing status via REST API."""

    def __init__(self, org: str, token: str, slack_webhook: Optional[str] = None):
        self.org = org
        self.token = token
        self.slack_webhook = slack_webhook
        self.api_base = "https://api.github.com"
        self.session = requests.Session()
        self.session.headers.update({
            "Authorization": f"token {token}",
            "Accept": "application/vnd.github.v3+json",
        })

    def check_billing_status(self) -> Dict[str, Any]:
        """
        Check GitHub Actions billing status for the organization.

        Returns:
            Dict with keys:
            - 'success': bool - Whether the check succeeded
            - 'status': str - 'active', 'suspended', or 'unknown'
            - 'details': dict - Raw API response or error details
            - 'timestamp': str - ISO format timestamp
        """
        try:
            # Get included_minutes for Actions (indicates if service is accessible)
            url = f"{self.api_base}/orgs/{self.org}/billing/actions"
            response = self.session.get(url, timeout=10)

            if response.status_code == 404:
                # Endpoint may not exist or org doesn't have billing data
                return {
                    'success': False,
                    'status': 'unknown',
                    'details': {'error': 'Billing endpoint returned 404 — org may not have Actions enabled'},
                    'timestamp': datetime.utcnow().isoformat(),
                }

            if response.status_code == 403:
                # Token lacks permission or access is suspended
                return {
                    'success': False,
                    'status': 'suspended',
                    'details': {
                        'error': 'Access forbidden (403) — billing may be suspended',
                        'response': response.text[:200],
                    },
                    'timestamp': datetime.utcnow().isoformat(),
                }

            if response.status_code != 200:
                return {
                    'success': False,
                    'status': 'unknown',
                    'details': {
                        'error': f'Unexpected status code: {response.status_code}',
                        'response': response.text[:200],
                    },
                    'timestamp': datetime.utcnow().isoformat(),
                }

            data = response.json()
            # If we got a response, the billing API is accessible
            # included_minutes is total minutes available; if response succeeds, service is active
            return {
                'success': True,
                'status': 'active',
                'details': {
                    'included_minutes': data.get('included_minutes', 'unknown'),
                    'total_minutes_used': data.get('total_minutes_used', 'unknown'),
                    'minutes_used_this_cycle': data.get('minutes_used_this_cycle', 'unknown'),
                },
                'timestamp': datetime.utcnow().isoformat(),
            }

        except requests.exceptions.Timeout:
            return {
                'success': False,
                'status': 'unknown',
                'details': {'error': 'API request timed out'},
                'timestamp': datetime.utcnow().isoformat(),
            }
        except requests.exceptions.RequestException as e:
            return {
                'success': False,
                'status': 'unknown',
                'details': {'error': f'Request failed: {str(e)[:200]}'},
                'timestamp': datetime.utcnow().isoformat(),
            }
        except Exception as e:
            return {
                'success': False,
                'status': 'unknown',
                'details': {'error': f'Unexpected error: {str(e)[:200]}'},
                'timestamp': datetime.utcnow().isoformat(),
            }

    def send_slack_alert(self, status: str, details: Dict[str, Any]) -> bool:
        """
        Send alert to Slack if billing is suspended.

        Args:
            status: 'active', 'suspended', or 'unknown'
            details: Details dict from check_billing_status

        Returns:
            True if alert was sent successfully, False otherwise
        """
        if not self.slack_webhook:
            return False

        if status == 'active':
            return False  # No alert needed if active

        color = '#ff0000' if status == 'suspended' else '#ff9900'
        title = f'⚠️ GitHub Actions Billing Alert — {status.upper()}'

        payload = {
            'blocks': [
                {
                    'type': 'header',
                    'text': {'type': 'plain_text', 'text': title},
                },
                {
                    'type': 'section',
                    'text': {
                        'type': 'mrkdwn',
                        'text': f'*Organization:* {self.org}\n*Status:* {status}\n*Time:* {datetime.utcnow().isoformat()}',
                    },
                },
                {
                    'type': 'section',
                    'text': {
                        'type': 'mrkdwn',
                        'text': f'```{json.dumps(details, indent=2)}```',
                    },
                },
            ],
        }

        try:
            response = requests.post(self.slack_webhook, json=payload, timeout=10)
            return response.status_code == 200
        except Exception as e:
            print(f"Error sending Slack alert: {e}", file=sys.stderr)
            return False

    def run(self) -> int:
        """
        Run the billing check and alert if needed.

        Returns:
            Exit code: 0 if active, 1 if suspended/error
        """
        print(f"Checking GitHub Actions billing for org: {self.org}", file=sys.stderr)

        result = self.check_billing_status()

        # Log result as JSON for easy parsing
        print(json.dumps(result))

        # Send alert if not active
        if result['status'] != 'active':
            self.send_slack_alert(result['status'], result['details'])
            if result['status'] == 'suspended':
                print(f"ALERT: GitHub Actions billing is SUSPENDED", file=sys.stderr)
                return 1

        print(f"OK: GitHub Actions billing is active", file=sys.stderr)
        return 0


def main():
    parser = argparse.ArgumentParser(
        description='Monitor GitHub Actions billing status',
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog='''
Examples:
  # Basic check
  python scripts/monitor_github_billing.py --org MyOrg --token ghp_xxxxx

  # With Slack webhook
  python scripts/monitor_github_billing.py \\
    --org MyOrg \\
    --token ghp_xxxxx \\
    --slack-webhook https://hooks.slack.com/services/...

  # Using environment variables
  export GITHUB_TOKEN=ghp_xxxxx
  export GITHUB_ORG=MyOrg
  python scripts/monitor_github_billing.py

  # In a cron job (every 30 minutes)
  */30 * * * * /usr/bin/python3 /path/to/monitor_github_billing.py >> /var/log/github_billing.log 2>&1
        '''
    )

    parser.add_argument(
        '--org',
        help='GitHub organization to monitor (env: GITHUB_ORG)',
    )
    parser.add_argument(
        '--token',
        help='GitHub personal access token (env: GITHUB_TOKEN)',
    )
    parser.add_argument(
        '--slack-webhook',
        help='Slack webhook URL for notifications (env: SLACK_WEBHOOK_URL)',
    )

    args = parser.parse_args()

    # Get values from args or environment
    org = args.org or os.getenv('GITHUB_ORG')
    token = args.token or os.getenv('GITHUB_TOKEN')
    slack_webhook = args.slack_webhook or os.getenv('SLACK_WEBHOOK_URL')

    if not org or not token:
        print("Error: --org and --token are required (or set GITHUB_ORG and GITHUB_TOKEN)", file=sys.stderr)
        parser.print_help()
        return 1

    monitor = GitHubBillingMonitor(org, token, slack_webhook)
    return monitor.run()


if __name__ == '__main__':
    sys.exit(main())
