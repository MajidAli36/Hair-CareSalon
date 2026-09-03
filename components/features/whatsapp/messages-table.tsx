"use client";

import { useCallback, useEffect, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { PaginatedList } from "@/components/ui/table-pagination";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { formatDateTime } from "@/lib/format";

type MessageRow = {
  id: string;
  direction: string;
  status: string;
  phone: string;
  body: string;
  created_at: string;
};

export function WhatsAppMessagesTable({ messages: initial }: { messages: MessageRow[] }) {
  const [liveMessages, setLiveMessages] = useState<MessageRow[] | null>(null);
  const [initialRef, setInitialRef] = useState(initial);
  if (initial !== initialRef) {
    setInitialRef(initial);
    setLiveMessages(null);
  }
  const messages = liveMessages ?? initial;

  const refresh = useCallback(async () => {
    try {
      const res = await fetch("/api/whatsapp/messages", { cache: "no-store" });
      if (!res.ok) return;
      const data = (await res.json()) as { messages?: MessageRow[] };
      if (data.messages) setLiveMessages(data.messages);
    } catch {
      // keep last known rows
    }
  }, []);

  useEffect(() => {
    const hasPending = messages.some((m) => m.status === "PENDING");
    const intervalMs = hasPending ? 2000 : 8000;
    const id = setInterval(() => {
      void refresh();
    }, intervalMs);
    return () => clearInterval(id);
  }, [messages, refresh]);

  return (
    <PaginatedList
      items={messages}
      empty={<p className="text-sm text-muted-foreground">No messages yet.</p>}
    >
      {(slice) => (
        <div className="rounded-lg border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Direction</TableHead>
                <TableHead>Phone</TableHead>
                <TableHead>Message</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Time</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {slice.map((msg) => (
                <TableRow key={msg.id}>
                  <TableCell>
                    <Badge variant={msg.direction === "INBOUND" ? "default" : "secondary"}>
                      {msg.direction}
                    </Badge>
                  </TableCell>
                  <TableCell>{msg.phone}</TableCell>
                  <TableCell className="max-w-xs truncate">{msg.body}</TableCell>
                  <TableCell>
                    <Badge
                      variant="outline"
                      className={
                        msg.status === "SENT"
                          ? "border-green-600 text-green-700"
                          : msg.status === "PENDING"
                            ? "border-amber-500 text-amber-700"
                            : msg.status === "FAILED"
                              ? "border-destructive text-destructive"
                              : undefined
                      }
                    >
                      {msg.status}
                    </Badge>
                  </TableCell>
                  <TableCell>{formatDateTime(msg.created_at)}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}
    </PaginatedList>
  );
}
