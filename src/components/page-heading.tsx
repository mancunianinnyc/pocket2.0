/**
 * The editorial page head shared by every app page: a serif title and an
 * italic serif line under it. No eyebrow, no box.
 */
export function PageHeading({
  title,
  dek,
}: {
  title: string;
  dek?: string;
}) {
  return (
    <header>
      <h1 className="font-serif text-[40px] font-medium leading-[1.04] tracking-[-0.025em] sm:text-[56px]">
        {title}
      </h1>
      {dek ? (
        <p className="mt-3 max-w-xl font-serif text-lg italic leading-relaxed text-ink/70 sm:text-xl">
          {dek}
        </p>
      ) : null}
    </header>
  );
}
