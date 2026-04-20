import { NextResponse } from "next/server";
import { userFavorites } from "@/auth.config";

export async function GET() {
    const favorites = Object.entries(userFavorites).map(([userId, gameIds]) => ({
        userId,
        favorites: gameIds
    }));

    return NextResponse.json({
        total: favorites.length,
        favorites
    });
}