import { NextRequest, NextResponse } from 'next/server';

import { createServerClient } from '@/lib/supabase';

export const dynamic = 'force-dynamic';

const ARCHIVE_BUCKET = 'feature-archives';

function normalizeStoragePath(storagePath: string): string {
  const trimmed = storagePath.trim();
  if (trimmed.length === 0) return '';

  let candidate = trimmed;

  if (trimmed.startsWith('http://') || trimmed.startsWith('https://')) {
    try {
      candidate = new URL(trimmed).pathname;
    } catch {
      candidate = trimmed;
    }
  }

  candidate = candidate
    .replace(/^\/+|\/+$/g, '')
    .replace(/^storage\/v1\/object\/(?:public|authenticated|sign)\//, '')
    .replace(new RegExp(`^${ARCHIVE_BUCKET}\/`), '');

  const pathSegments = candidate.split('/').filter((segment) => segment.length > 0);
  if (pathSegments.length > 0 && pathSegments[0] === ARCHIVE_BUCKET) {
    pathSegments.shift();
  }

  return pathSegments.join('/');
}

function buildObjectPath(storagePath: string, fileName: string): string {
  const normalizedStoragePath = normalizeStoragePath(storagePath);
  const normalizedFileName = fileName.replace(/^\/+|\/+$/g, '');

  if (normalizedStoragePath.endsWith(`/${normalizedFileName}`) || normalizedStoragePath === normalizedFileName) {
    return normalizedStoragePath;
  }

  return `${normalizedStoragePath}/${normalizedFileName}`.replace(/^\/+/, '');
}

export async function GET(request: NextRequest) {
  const featureId = request.nextUrl.searchParams.get('featureId');
  const fileName = request.nextUrl.searchParams.get('fileName');

  if (!featureId || !fileName) {
    return new NextResponse('featureId and fileName are required.', { status: 400 });
  }

  const supabase = createServerClient();
  const { data: archive, error: archiveError } = await supabase
    .from('feature_archives')
    .select('storage_path, files_archived')
    .eq('feature_id', featureId)
    .maybeSingle();

  if (archiveError != null || archive == null) {
    return new NextResponse('Archive metadata not found for feature.', { status: 404 });
  }

  if (!Array.isArray(archive.files_archived) || !archive.files_archived.includes(fileName)) {
    return new NextResponse('Requested file is not present in the recorded feature archive.', { status: 404 });
  }

  const objectPath = buildObjectPath(String(archive.storage_path), fileName);
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
