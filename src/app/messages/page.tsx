
import React from "react";
import Navbar from "@/components/navbar";
import { useSession } from "next-auth/react";


export default function MessagesPage() {
    const { data: session } = useSession();
    if (!session) {
        return (
            <div className="container mx-auto p-4">
                <h1 className="text-2xl font-bold mb-4">Messages</h1>
                <p className="text-gray-600">Please sign in to view your messages.</p>
            </div>
        );
    }

    const userId = session.user?.id;
    

    return (
        <div>
            <Navbar />
            <div className="container mx-auto p-4">
                <h1 className="text-2xl font-bold mb-4">Messages</h1>
                <p className="text-gray-600">This is where your messages will appear.</p>
            </div>
        </div>
    );
}