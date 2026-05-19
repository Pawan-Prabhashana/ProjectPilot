import type { Metadata } from 'next';
import { requireAuth } from '@/lib/rbac';
import { InfoCallout } from '@/components/shared/info-callout';
import { PageHeader } from '@/components/shared/page-header';

export const metadata: Metadata = { title: 'Supervisor Management' };

export default async function SupervisorManagementPage() {
  const user = await requireAuth();

  if (user.role !== 'COORDINATOR') {
    return (
      <div className="space-y-6">
        <PageHeader title="Supervisor Management" description="Coordinator-only management tool." />
        <InfoCallout variant="warning">
          This page is only accessible to coordinators.
        </InfoCallout>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Supervisor Management"
        description="Assign supervisors to teams and manage supervisor capacity."
      />
      <InfoCallout variant="info" title="Coming in a future update">
        Full supervisor management — including assigning supervisors to teams, reviewing
        supervisor capacity, and managing supervisor accounts — will be available in a
        future update. Use the Coordinator Dashboard for current operational oversight.
      </InfoCallout>
    </div>
  );
}
