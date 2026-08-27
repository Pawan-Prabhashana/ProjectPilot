import type { Metadata } from 'next';
import Link from 'next/link';
import { requireAuth, requireRole } from '@/lib/rbac';
import { PageHeader } from '@/components/shared/page-header';
import { InfoCallout } from '@/components/shared/info-callout';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { CommunicationTranslator } from '@/components/support/communication-translator';
import { SocialTranslator } from '@/components/support/social-translator';
import { ArrowLeft, MessageSquare, Search } from 'lucide-react';

export const metadata: Metadata = { title: 'Communication Tools — ProjectPilot' };

export default async function CommunicatePage() {
  const user = await requireAuth();
  requireRole(user, ['STUDENT']);

  return (
    <div className="space-y-6 max-w-3xl">
      {/* Back link */}
      <Link
        href="/dashboard/support-tools"
        className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors"
      >
        <ArrowLeft className="h-3.5 w-3.5" />
        Support Tools
      </Link>

      <PageHeader
        title="Communication Tools"
        description="Rewrite messages with confidence, and decode ambiguous communication into clearer language."
      />

      <InfoCallout variant="info">
        These tools are private to you. Nothing you type here is stored or shared.
        Use them to prepare messages before sending, or to understand messages you have already received.
      </InfoCallout>

      <div className="space-y-8">
        {/* Translator */}
        <Card>
          <CardHeader className="pb-2">
            <div className="flex items-center gap-2">
              <div className="h-8 w-8 rounded-lg bg-violet-100 flex items-center justify-center">
                <MessageSquare className="h-4 w-4 text-violet-600" />
              </div>
              <div>
                <CardTitle className="text-base">Communication Style Translator</CardTitle>
                <CardDescription className="text-xs mt-0.5">
                  Rewrite your message in a different style — direct, gentle, formal, or action-oriented.
                </CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <CommunicationTranslator />
          </CardContent>
        </Card>

        {/* Social translator */}
        <Card>
          <CardHeader className="pb-2">
            <div className="flex items-center gap-2">
              <div className="h-8 w-8 rounded-lg bg-amber-100 flex items-center justify-center">
                <Search className="h-4 w-4 text-amber-600" />
              </div>
              <div>
                <CardTitle className="text-base">Social Signal Decoder</CardTitle>
                <CardDescription className="text-xs mt-0.5">
                  Analyse a received message for hidden expectations, soft deadlines, and unclear ownership.
                </CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <SocialTranslator />
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
