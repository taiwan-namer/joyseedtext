import { NextResponse } from "next/server";
import { getGlobalCategoriesFromMain } from "@/app/actions/storeSettingsActions";

export async function GET() {
  const categories = await getGlobalCategoriesFromMain();
  return NextResponse.json({ categories });
}

