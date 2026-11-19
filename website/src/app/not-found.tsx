import Link from "next/link";

export default function NotFound() {
  return (
    <div className="min-h-screen bg-[#FFFFFC] text-[#170404] flex flex-col justify-between p-6 sm:p-10">
      <div className="mx-auto w-full max-w-5xl">
        <Link
          href="/"
          className="inline-flex items-center gap-2.5 text-xl font-medium tracking-tight text-[#170404]"
        >
          <span className="flex h-7 w-7 items-center justify-center rounded-md bg-[#170404] text-[#FFFFFC] text-sm font-medium">
            B
          </span>
          <span>Browsy</span>
        </Link>
      </div>

      <main className="my-auto mx-auto max-w-md text-center py-12">
        <p className="text-xs font-medium uppercase tracking-widest text-[#9E506E]">
          404 · Page Not Found
        </p>
        <h1 className="mt-3 text-4xl font-medium tracking-[-0.03em] text-[#170404]">
          We couldn&apos;t find that page.
        </h1>
        <p className="mt-3 text-base text-[#8C7A7E]">
          The route you requested does not exist. Return to the Browsy homepage
          or explore the informational links below.
        </p>
        <div className="mt-8">
          <Link
            href="/"
            className="inline-flex h-12 items-center justify-center rounded-[8px] border-[1.5px] border-[#170404] bg-[#170404] px-6 text-sm font-medium text-[#FFFFFC] hover:bg-black"
          >
            Return to Homepage
          </Link>
        </div>
      </main>

      <footer className="mx-auto flex max-w-5xl flex-wrap items-center justify-center gap-x-3 gap-y-2 text-xs text-[#8C7A7E]">
        <Link href="/virtual-try-on" className="hover:text-[#170404]">
          Virtual Try-On
        </Link>
        <span>·</span>
        <Link href="/privacy-policy" className="hover:text-[#170404]">
          Privacy Policy
        </Link>
        <span>·</span>
        <Link href="/terms-of-service" className="hover:text-[#170404]">
          Terms of Service
        </Link>
        <span>·</span>
        <Link href="/acceptable-use-policy" className="hover:text-[#170404]">
          Acceptable Use Policy
        </Link>
      </footer>
    </div>
  );
}
