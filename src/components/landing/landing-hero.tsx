import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { siteConfig } from "@/config/site";

const roleCards = [
  {
    title: "Students",
    description:
      "Execute year-long group work with a clear view of your team, project, and upcoming tasks.",
  },
  {
    title: "Supervisors",
    description:
      "Oversee multiple teams from one place, without losing track of progress or ownership.",
  },
] as const;

export function LandingHero() {
  return (
    <section className="mx-auto max-w-6xl px-4 py-16 sm:px-6 sm:py-24">
      <p className="mb-3 text-sm font-medium text-secondary">
        University group projects
      </p>
      <h1 className="max-w-3xl text-balance text-4xl font-semibold tracking-tight text-foreground sm:text-5xl">
        {siteConfig.tagline}
      </h1>
      <p className="mt-4 max-w-2xl text-base leading-relaxed text-muted-foreground sm:text-lg">
        {siteConfig.description}
      </p>
      <div className="mt-8">
        <Button size="lg" type="button">
          Log in
        </Button>
      </div>

      <div className="mt-14 grid gap-4 sm:grid-cols-2">
        {roleCards.map((card) => (
          <Card key={card.title}>
            <CardHeader>
              <CardTitle>{card.title}</CardTitle>
              <CardDescription>{card.description}</CardDescription>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground">
                Available after authentication in a later phase.
              </p>
            </CardContent>
          </Card>
        ))}
      </div>
    </section>
  );
}
