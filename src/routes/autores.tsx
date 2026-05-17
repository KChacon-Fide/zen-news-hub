import { createFileRoute } from "@tanstack/react-router";
import { Users } from "lucide-react";

import { SiteFooter, SiteHeader } from "@/components/SiteHeader";
import { getAuthors } from "@/lib/news.functions";

export const Route = createFileRoute("/autores")({
  head: () => ({ meta: [{ title: "Autores - ZEN NEWS" }] }),
  loader: () => getAuthors(),
  component: AuthorsPage,
});

function AuthorsPage() {
  const { authors } = Route.useLoaderData();

  return (
    <div className="min-h-screen">
      <SiteHeader />
      <main className="mx-auto max-w-7xl px-4 py-12 md:px-6">
        <div className="flex items-center gap-2 text-xs font-bold uppercase text-accent">
          <Users className="h-4 w-4" /> Autores
        </div>
        <h1 className="mt-3 font-serif text-5xl font-black">Firmas editoriales</h1>
        <div className="mt-10 grid grid-cols-1 gap-5 md:grid-cols-3">
          {authors.map((author: any) => (
            <article key={author.id} className="rounded-md border border-border p-6">
              <div className="flex items-center gap-4">
                {author.avatar_url ? (
                  <img
                    src={author.avatar_url}
                    alt={author.name}
                    className="h-14 w-14 rounded-full object-cover"
                  />
                ) : (
                  <div className="flex h-14 w-14 items-center justify-center rounded-full bg-muted font-serif text-xl font-black">
                    {author.name.slice(0, 1)}
                  </div>
                )}
                <div>
                  <h2 className="font-serif text-xl font-bold">{author.name}</h2>
                  {author.email && <p className="text-xs text-muted-foreground">{author.email}</p>}
                </div>
              </div>
              {author.bio && (
                <p className="mt-4 text-sm leading-6 text-muted-foreground">{author.bio}</p>
              )}
            </article>
          ))}
        </div>
      </main>
      <SiteFooter />
    </div>
  );
}
