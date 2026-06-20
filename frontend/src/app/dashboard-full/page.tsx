import { readFileSync } from 'fs';
import { join } from 'path';

export default function DashboardFullPage() {
  const dashboardPath = join(process.cwd(), 'public', 'dash-v2.html');
  const htmlContent = readFileSync(dashboardPath, 'utf-8');

  return (
    <div dangerouslySetInnerHTML={{ __html: htmlContent }} />
  );
}
