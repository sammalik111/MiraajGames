import { NextRequest, NextResponse } from "next/server";
import { signOut } from "@/auth";

export async function POST(req: NextRequest) {
  try {
    // Call NextAuth's signOut to clear the session
    await signOut({ redirect: false });
    
    return NextResponse.json(
      { message: "Signed out successfully" },
      { status: 200 }
    );
  } catch (error) {
    console.error("Sign out error:", error);
    return NextResponse.json(
      { error: "Sign out failed" },
      { status: 500 }
    );
  }
}
