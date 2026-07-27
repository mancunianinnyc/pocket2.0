import { NextResponse } from "next/server";

function firstUrl(...values: Array<FormDataEntryValue | null>) {
  const urlPattern = /https?:\/\/[^\s]+/i;
  for (const value of values) {
    if (typeof value !== "string") continue;
    const match = value.match(urlPattern);
    if (match) return match[0];
  }
  return null;
}

export async function POST(request: Request) {
  const formData = await request.formData();
  const url = firstUrl(
    formData.get("url"),
    formData.get("text"),
    formData.get("title"),
  );
  const destination = new URL("/save", request.url);
  if (url) destination.searchParams.set("url", url);
  return NextResponse.redirect(destination, 303);
}
