# GitHub Actions Billing Monitor

**Issue:** [#986 — Monitoramento de billing GitHub Actions](https://github.com/IsakielSouza/agents-ia/issues/986)

## Overview

The GitHub Actions Billing Monitor detects when GitHub Actions billing has been suspended, preventing silent CI/CD failures like the incident in #954.

## Problem

GitHub Actions billing can be suspended silently:
- In #954, billing was suspended but no alerts were sent
- CI/CD remained broken for 3 days before discovery
- No endpoint initially identified, but investigation found GitHub Billing API

## Solution

### 1. GitHub Billing API Check

The monitor uses the GitHub Billing API to check Actions status:

```
GET /orgs/{org}/billing/actions
```

**Status Indicators:**
- `200 OK` → Billing is active
- `403 Forbidden` → Access suspended or token invalid
- `404 Not Found` → Endpoint not available (rare)

### 2. Deployment Options

#### Option A: Cron Job (Recommended)

Add to system crontab for background monitoring:

```bash
# /etc/cron.d/github-billing-monitor
*/30 * * * * root /usr/bin/python3 /opt/claude-office/scripts/monitor_github_billing.py >> /var/log/github_billing.log 2>&1
```

**Requirements:**
- Python 3.9+
- `requests` library installed
- GitHub token with `admin:org_hook` scope
- Environment variables set:
  - `GITHUB_TOKEN`
  - `GITHUB_ORG`
  - `SLACK_WEBHOOK_URL` (optional)

#### Option B: Cloud Agent / Scheduled Task

Use the project's cloud agent infrastructure to run checks periodically:

```bash
# Schedule via existing automation (gerente-loop, etc.)
schedule-task monitor-github-billing --interval 30m --log-level warn
```

### 3. Alert Routing

**Slack Integration (Real-time):**
- Set `SLACK_WEBHOOK_URL` environment variable
- Script sends message if status != 'active'
- Color-coded: red for 'suspended', orange for 'unknown'

**HITL Ask (Manual Review):**
- Can integrate with existing HITL ask system
- Example: Dispatch ask if billing check fails 3 times

**Fallback: Log File**
- JSON output logged for manual inspection
- Rotation via standard log management (logrotate)

## Installation

### 1. Install Dependencies

```bash
pip install requests
```

### 2. Create GitHub Token

1. Go to https://github.com/settings/tokens
2. Click "Generate new token (classic)"
3. Scopes: `admin:org_hook` (read-only access to org billing)
4. Copy token

### 3. Set Up Environment

```bash
export GITHUB_TOKEN=ghp_xxxxxxxxxxxxxxx
export GITHUB_ORG=YourOrgName
export SLACK_WEBHOOK_URL=https://hooks.slack.com/services/...
```

Or create `.env` file:

```env
GITHUB_TOKEN=ghp_xxxxxxxxxxxxxxx
GITHUB_ORG=YourOrgName
SLACK_WEBHOOK_URL=https://hooks.slack.com/services/...
```

### 4. Test Run

```bash
python3 scripts/monitor_github_billing.py
```

Expected output (JSON):

```json
{
  "success": true,
  "status": "active",
  "details": {
    "included_minutes": 3000,
    "total_minutes_used": 250,
    "minutes_used_this_cycle": 125
  },
  "timestamp": "2026-06-24T22:45:30.123456"
}
```

### 5. Deploy as Cron Job

```bash
# Copy script to system location
sudo cp scripts/monitor_github_billing.py /opt/claude-office/monitor_github_billing.py

# Create cron job
echo '*/30 * * * * root /usr/bin/python3 /opt/claude-office/monitor_github_billing.py >> /var/log/github_billing.log 2>&1' | sudo tee /etc/cron.d/github-billing-monitor

# Verify
sudo systemctl restart cron
tail -f /var/log/github_billing.log
```

## Monitoring & Alerting

### Log File Analysis

Check logs for suspicious patterns:

```bash
# Find all suspensions
grep -i 'suspended' /var/log/github_billing.log

# Find errors
grep -i 'error' /var/log/github_billing.log

# Last 30 min of checks
grep "$(date -d '30 min ago' '+%Y-%m-%dT%H:%M')" /var/log/github_billing.log
```

### Slack Alert Examples

**Active Billing (No Alert):**
- Status: active
- Minutes available: 3000
- No message sent

**Suspended Billing (Alert Sent):**

```
⚠️ GitHub Actions Billing Alert — SUSPENDED

Organization: MyOrg
Status: suspended
Time: 2026-06-24T22:45:30.123456

{
  "error": "Access forbidden (403) — billing may be suspended",
  "response": "..."
}
```

## Troubleshooting

### Token Permission Error

**Error:** `Access forbidden (403)` but billing is not suspended

**Solution:**
- Token needs `admin:org_hook` scope
- Regenerate token with correct scopes

### API Timeout

**Error:** `Request timed out`

**Solution:**
- Network connectivity issue
- GitHub API momentarily unavailable
- Cron job will retry in 30 minutes

### Unknown Status

**Error:** Status is 'unknown' instead of 'active' or 'suspended'

**Reasons:**
- Endpoint returned unexpected status code
- Organization doesn't have Actions enabled
- GitHub API changed format

**Solution:**
- Check GitHub API documentation
- Verify org has Actions enabled
- Open issue if persists

## Maintenance

### Update Frequency

Review/update monitor every 6 months:
- Check for GitHub API changes
- Verify Slack webhook still works
- Review log rotation settings

### Metrics to Track

Monitor these signals over time:

```json
{
  "total_minutes_used": "trend over time",
  "minutes_used_this_cycle": "% of allocation",
  "check_success_rate": "should be >99%"
}
```

## Related

- **Issue #954:** GitHub billing suspension incident (root cause)
- **GitHub Billing API:** https://docs.github.com/en/rest/billing
- **Slack Webhooks:** https://api.slack.com/messaging/webhooks
