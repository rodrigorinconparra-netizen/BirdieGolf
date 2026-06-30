import Link from "next/link";
import { Search } from "lucide-react";
import { getSession } from "@/lib/auth/session";
import { getFollowingFeed } from "@/lib/social";
import { PageHeader } from "@/components/ui/page-header";
import { FeedTabs } from "@/components/feed-tabs";

export const dynamic = "force-dynamic";

export default async function FeedPage() {
  const session = await getSession();
  const following = session ? await getFollowingFeed(session.userId) : [];

  return (
    <>
      <PageHeader
        title="Feed"
        subtitle="Las vueltas públicas de la comunidad."
        action={
          <Link href="/players" className="btn-ghost">
            <Search className="h-4 w-4" /> Buscar jugadores
          </Link>
        }
      />
      <FeedTabs following={following} />
    </>
  );
}
