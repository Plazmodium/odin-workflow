import { NextRequest, NextResponse } from 'next/server';

import { createServerClient } from '@/lib/supabase';

export const dynamic = 'force-dynamic';

const ARCHIVE_BUCKET = 'feature-archives';

function normalizeStoragePath(storagePath: string): string {
  return storagePath.replace(/^\/+|\/+$/g, '');
}

export async function GET(request: NextRequest) {
  const storagePath = request.nextUrl.searchParams.get('storagePath');
  const fileName = request.nextUrl.searchParams.get('fileName');

  if (!storagePath || !fileName) {
    return new NextResponse('storagePath and fileName are required.', { status: 400 });
  }

  const objectPath = `${normalizeStoragePath(storagePath)}/${fileName}`;
  const supabase = createServerClient();
  const { data, error } = await supabase.storage.from(ARCHIVE_BUCKET).download(objectPath);

  if (error != null || data == null) {
    const status = error?.message.includes('not found') ? 404 : 400;
    return new NextResponse(error?.message ?? 'Failed to load archive file.', { status });
  }

  const content = await data.text();

  return new NextResponse(content, {
    status: 200,
    headers: {
      'Content-Type': 'text/markdown; charset=utf-8',
      'Cache-Control': 'no-store',
    },
  });
}
