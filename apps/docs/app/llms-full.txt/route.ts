import { getLLMText, source } from '@/lib/source';

export const revalidate = false;

export async function GET() {
  const scan = [];
  for (const page of source.getPages()) {
    scan.push(getLLMText(page));
  }
  const scanned = await Promise.all(scan);

  return new Response(scanned.join('\n\n'));
}
