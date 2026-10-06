// Job service report — shared by the admin app and the tech app (keep the two copies identical).
// The web app's src/lib/generateJobReport.ts draws the same sections in the same order.
//
// Sections, in order: header (logo, company) · job details + customer · description ·
// work summary (Problem/Issue, Troubleshooting, Resolution) · notes · parts · completed checks ·
// photos · completed banner · customer sign-off · footer.
// A section is left out entirely when there is nothing to put in it.
import { supabase } from './supabase';
import { getOrgId } from './getOrgId';
import { CLOSING_QUESTIONS, parseClosingNotes } from './closingNotes';

// ---------- Template ----------

export interface JobReportOptions {
  /** Checklist items; only ticked ones are printed */
  checklist?: { label: string; done: boolean }[];
  /** Public photo URLs (or data URIs) for this job */
  photos?: string[];
  /** Parts used — names and quantities only; prices belong on the invoice */
  parts?: { name: string; qty: number }[];
  technicianName?: string | null;
  /** Drawn signature (data URI or URL), when one was captured */
  signatureImage?: string | null;
}

const MAX_REPORT_PHOTOS = 8;

function esc(value: any): string {
  return String(value ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

// White or dark text, whichever is readable on the company's brand colour
function readableTextOn(hex: string): string {
  const m = /^#?([0-9a-f]{6})$/i.exec((hex || '').trim());
  if (!m) return '#FFFFFF';
  const n = parseInt(m[1], 16);
  const luminance = (0.299 * ((n >> 16) & 255) + 0.587 * ((n >> 8) & 255) + 0.114 * (n & 255)) / 255;
  return luminance > 0.62 ? '#0F172A' : '#FFFFFF';
}

// Supabase can resize public images on the fly; reports use this so a job with several
// camera photos doesn't produce a huge PDF.
export function resizedPhotoUrl(publicUrl: string, width = 900): string {
  if (!publicUrl.includes('/storage/v1/object/public/')) return publicUrl;
  return `${publicUrl.replace('/storage/v1/object/public/', '/storage/v1/render/image/public/')}?width=${width}&quality=70&resize=contain`;
}

// The PDF renderer doesn't reliably wait for remote images, so they are embedded
async function urlToDataUri(url: string): Promise<string | null> {
  try {
    const res = await fetch(url);
    if (!res.ok) return null;
    const blob = await res.blob();
    return await new Promise<string | null>((resolve) => {
      const reader = new FileReader();
      reader.onloadend = () => resolve(typeof reader.result === 'string' ? reader.result : null);
      reader.onerror = () => resolve(null);
      reader.readAsDataURL(blob);
    });
  } catch { return null; }
}

/** Resizes and embeds the job's photos (and logo) so they always appear in the PDF. */
export async function prepareReportImages(photoUrls: string[], logoUrl?: string | null) {
  const picked = photoUrls.slice(0, MAX_REPORT_PHOTOS);
  const [photos, logo] = await Promise.all([
    Promise.all(picked.map(async (url) => (await urlToDataUri(resizedPhotoUrl(url))) || (await urlToDataUri(url)))),
    logoUrl ? urlToDataUri(logoUrl) : Promise.resolve(null),
  ]);
  return { photos: photos.filter((p): p is string => !!p), logo, omitted: Math.max(0, photoUrls.length - picked.length) };
}

function formatDuration(seconds: number): string {
  const h = Math.floor(seconds / 3600);
  const m = Math.round((seconds % 3600) / 60);
  return h > 0 ? `${h}h ${m}m` : `${m} min`;
}

export function buildJobReportHtml(job: any, org: any, options: JobReportOptions = {}): string {
  const brandColor = /^#[0-9a-f]{6}$/i.test(org?.brand_color || '') ? org.brand_color : '#0066FF';
  const onBrand = readableTextOn(brandColor);
  const companyName = org?.name || 'Field Service Pro';
  const reportDate = new Date().toLocaleDateString('en-AU', { day: 'numeric', month: 'long', year: 'numeric' });
  const jobDate = job.date ? new Date(job.date + 'T00:00:00').toLocaleDateString('en-AU', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' }) : 'N/A';
  const jobRef = job.job_number || job.id?.slice(0, 8) || '';

  const sectionTitle = (title: string) =>
    `<div style="font-size:12.5pt;font-weight:800;color:#0F172A;text-transform:uppercase;letter-spacing:0.8px;border-bottom:2px solid ${brandColor};padding-bottom:6px;margin-bottom:12px;">${esc(title)}</div>`;
  const section = (title: string, body: string) =>
    `<div style="margin-bottom:24px;page-break-inside:avoid;">${sectionTitle(title)}${body}</div>`;
  const row = (label: string, value: any) => value ? `
    <tr>
      <td style="padding:8px 12px 8px 0;color:#475569;font-size:10.5pt;vertical-align:top;white-space:nowrap;">${esc(label)}</td>
      <td style="padding:8px 0;font-size:10.5pt;font-weight:600;color:#0F172A;text-align:right;">${esc(value)}</td>
    </tr>` : '';
  const textBlock = (text: string) =>
    `<div style="font-size:10.5pt;line-height:1.65;color:#1E293B;white-space:pre-wrap;">${esc(text)}</div>`;

  const logoHtml = org?.logo_url ? `<img src="${esc(org.logo_url)}" style="max-height:60px;max-width:170px;object-fit:contain;display:block;margin-left:auto;margin-bottom:8px;background:#fff;border-radius:6px;padding:4px;" />` : '';

  // Work summary: the three closing questions, each under its own heading
  const closing = parseClosingNotes(job.closing_notes);
  const answered = CLOSING_QUESTIONS.filter(q => closing[q.key]);
  const workSummaryHtml = answered.length ? section('Work Summary', answered.map(q => `
      <div style="border:1px solid #CBD5E1;border-radius:8px;padding:14px 16px;margin-bottom:10px;page-break-inside:avoid;">
        <div style="font-size:12pt;font-weight:800;color:${brandColor === '#0066FF' ? '#0052CC' : '#0F172A'};margin-bottom:6px;">${esc(q.heading)}</div>
        ${textBlock(closing[q.key])}
      </div>`).join('')) : '';

  // Checklist: only what was actually ticked. Unticked items are left out rather than shown as failures.
  const doneItems = (options.checklist || []).filter(item => item.done);
  const checklistHtml = doneItems.length ? section('Completed Checks', `
      <table style="width:100%;border-collapse:collapse;">
        ${doneItems.map(item => `
          <tr><td style="padding:7px 0;font-size:10.5pt;color:#0F172A;border-bottom:1px solid #E2E8F0;">
            <span style="display:inline-block;width:20px;font-weight:800;color:#15803D;">&#10003;</span>${esc(item.label)}
          </td></tr>`).join('')}
      </table>`) : '';

  const parts = (options.parts || []).filter(p => p.name);
  const partsHtml = parts.length ? section('Parts & Materials Used', `
      <table style="width:100%;border-collapse:collapse;">
        ${parts.map(p => `
          <tr>
            <td style="padding:7px 0;font-size:10.5pt;color:#0F172A;border-bottom:1px solid #E2E8F0;">${esc(p.name)}</td>
            <td style="padding:7px 0;font-size:10.5pt;color:#475569;border-bottom:1px solid #E2E8F0;text-align:right;white-space:nowrap;">Qty ${esc(p.qty)}</td>
          </tr>`).join('')}
      </table>`) : '';

  const photos = (options.photos || []).slice(0, MAX_REPORT_PHOTOS);
  const photosHtml = photos.length ? `
    <div style="margin-bottom:24px;">
      ${sectionTitle(`Photos (${photos.length})`)}
      <table style="width:100%;border-collapse:collapse;">
        ${Array.from({ length: Math.ceil(photos.length / 2) }, (_, r) => `
          <tr style="page-break-inside:avoid;">
            ${[photos[r * 2], photos[r * 2 + 1]].map((src, c) => `
              <td style="width:50%;vertical-align:top;padding:0 ${c === 0 ? '6px' : '0'} 12px ${c === 0 ? '0' : '6px'};">${src ? `<img src="${esc(src)}" style="width:100%;height:230px;object-fit:cover;border-radius:8px;border:1px solid #CBD5E1;display:block;" />` : ''}</td>`).join('')}
          </tr>`).join('')}
      </table>
    </div>` : '';

  // Sign-off: only when something was actually captured — a drawn signature and/or the customer's name
  const signerName = job.customer_signature_name;
  const signatureImage = options.signatureImage;
  const signOffHtml = (signerName || signatureImage) ? section('Customer Sign-off', `
      <div style="border:1px solid #CBD5E1;border-radius:8px;padding:14px 16px;">
        ${signatureImage ? `<img src="${esc(signatureImage)}" style="max-height:90px;max-width:240px;display:block;margin-bottom:8px;" />` : ''}
        ${signerName ? `<div style="font-size:11.5pt;font-weight:700;color:#0F172A;">${esc(signerName)}</div>` : ''}
        <div style="font-size:10pt;color:#475569;margin-top:4px;">Confirmed the work on job #${esc(jobRef)} was completed.</div>
      </div>`) : '';

  const completedDate = job.completed_at ? new Date(job.completed_at).toLocaleDateString('en-AU', { day: 'numeric', month: 'long', year: 'numeric' }) : null;
  const timeLabel = job.time_start ? `${String(job.time_start).slice(0, 5)}${job.time_end ? ' – ' + String(job.time_end).slice(0, 5) : ''}` : '';
  const isCompleted = job.status === 'completed';

  return `<!DOCTYPE html>
<html><head><meta charset="utf-8">
<style>
  @page { margin: 0; }
  * { margin:0; padding:0; box-sizing:border-box; }
  body { font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Helvetica,Arial,sans-serif; color:#1E293B; background:#fff; font-size:10.5pt; line-height:1.4; -webkit-print-color-adjust:exact; print-color-adjust:exact; }
  table { page-break-inside:auto; }
</style>
</head><body>
  <table style="width:100%;border-collapse:collapse;background:${brandColor};"><tr>
    <td style="padding:28px 0 28px 40px;color:${onBrand};vertical-align:middle;">
      <div style="font-size:10pt;font-weight:700;letter-spacing:1.5px;text-transform:uppercase;margin-bottom:4px;">Service Report</div>
      <div style="font-size:22pt;font-weight:800;">#${esc(jobRef)}</div>
      <div style="display:inline-block;margin-top:10px;border:1.5px solid ${onBrand};padding:4px 14px;border-radius:20px;font-size:10pt;font-weight:700;text-transform:uppercase;">${esc((job.status || 'completed').replace(/_/g, ' '))}</div>
    </td>
    <td style="padding:28px 40px 28px 0;text-align:right;color:${onBrand};vertical-align:middle;">
      ${logoHtml}
      <div style="font-size:15pt;font-weight:800;">${esc(companyName)}</div>
      ${org?.abn ? `<div style="font-size:10pt;margin-top:2px;">ABN: ${esc(org.abn)}</div>` : ''}
      ${org?.phone ? `<div style="font-size:10pt;">${esc(org.phone)}</div>` : ''}
      ${org?.email ? `<div style="font-size:10pt;">${esc(org.email)}</div>` : ''}
    </td>
  </tr></table>

  <div style="padding:32px 40px;">
    <table style="width:100%;border-collapse:collapse;margin-bottom:28px;"><tr>
      <td style="width:50%;vertical-align:top;padding-right:16px;">
        ${sectionTitle('Job Details')}
        <table style="width:100%;border-collapse:collapse;">
          ${row('Job', job.title)}
          ${row('Service type', job.type)}
          ${row('Service date', jobDate)}
          ${row('Time', timeLabel)}
          ${row('Technician', options.technicianName)}
          ${row('Completed', completedDate)}
          ${row('Time on job', job.time_spent_seconds ? formatDuration(job.time_spent_seconds) : '')}
        </table>
      </td>
      <td style="width:50%;vertical-align:top;padding-left:16px;">
        ${sectionTitle('Customer')}
        <table style="width:100%;border-collapse:collapse;">
          ${row('Name', job.customer_name)}
          ${row('Address', job.address)}
          ${row('Phone', job.customer_phone)}
          ${row('Email', job.customer_email)}
        </table>
      </td>
    </tr></table>

    ${job.description ? section('Job Description', textBlock(job.description)) : ''}
    ${workSummaryHtml}
    ${job.notes ? section('Job Notes', textBlock(job.notes)) : ''}
    ${partsHtml}
    ${checklistHtml}
    ${photosHtml}
    ${isCompleted ? `
    <div style="background:#F0FDF4;border:1.5px solid #86EFAC;border-radius:10px;padding:16px 20px;margin-bottom:24px;page-break-inside:avoid;">
      <div style="font-size:12pt;font-weight:800;color:#166534;">&#10003; Job Completed</div>
      <div style="font-size:10.5pt;color:#166534;margin-top:2px;">This service was completed by ${esc(companyName)}${completedDate ? ` on ${esc(completedDate)}` : ''}.</div>
    </div>` : ''}
    ${signOffHtml}
  </div>

  <div style="padding:18px 40px;background:#F1F5F9;border-top:1px solid #CBD5E1;page-break-inside:avoid;">
    <table style="width:100%;border-collapse:collapse;"><tr>
      <td style="font-size:10pt;color:#475569;line-height:1.6;vertical-align:top;">
        <div style="font-size:10pt;font-weight:800;color:#0F172A;">${esc(companyName)}</div>
        ${org?.address ? `<div>${esc(org.address)}</div>` : ''}
        ${[org?.phone, org?.email].filter(Boolean).map(esc).join(' &nbsp;·&nbsp; ')}
      </td>
      <td style="font-size:10pt;color:#475569;text-align:right;line-height:1.6;vertical-align:top;">
        <div>Report #${esc(jobRef)}</div>
        <div>Generated ${esc(reportDate)}</div>
        <div style="color:#64748B;">Powered by Field Service Pro</div>
      </td>
    </tr></table>
  </div>
</body></html>`;
}

// ---------- Loading the report's data ----------

const PHOTO_BUCKET = 'job-photos';

/** Photo URLs for a job, read from storage: the job's own folder plus the older top-level job-<id>- names. */
export async function listJobPhotoUrls(jobId: string): Promise<string[]> {
  const bucket = supabase.storage.from(PHOTO_BUCKET);
  const isImage = (name: string) => /\.(jpe?g|png|webp|heic)$/i.test(name);
  const [{ data: files }, { data: legacyFiles }] = await Promise.all([
    bucket.list(`${jobId}/`, { sortBy: { column: 'created_at', order: 'asc' } }),
    bucket.list('', { search: `job-${jobId}-` }),
  ]);
  return [
    ...(files || []).filter(f => f.id && isImage(f.name)).map(f => bucket.getPublicUrl(`${jobId}/${f.name}`).data.publicUrl),
    ...(legacyFiles || []).filter(f => f.id && f.name.startsWith(`job-${jobId}-`) && isImage(f.name)).map(f => bucket.getPublicUrl(f.name).data.publicUrl),
  ];
}

/** Parts and materials from both tables the apps write to (admin app: job_parts, tech app: job_materials). */
async function loadJobParts(jobId: string): Promise<{ name: string; qty: number }[]> {
  const [{ data: parts }, { data: materials }] = await Promise.all([
    supabase.from('job_parts').select('name, quantity').eq('job_id', jobId),
    supabase.from('job_materials').select('name, quantity').eq('job_id', jobId),
  ]);
  return [...(parts || []), ...(materials || [])].map((p: any) => ({ name: p.name, qty: p.quantity || 1 }));
}

/**
 * Builds the service report PDF for a job. Pass `base64: true` to also get the file contents,
 * which is what the send-job-report function needs to store and link the PDF.
 */
export async function createJobReportPdf(
  job: any,
  user: any,
  options: { checklist?: { label: string; done: boolean }[]; base64?: boolean } = {},
) {
  const orgId = job.organization_id || await getOrgId(user);
  const [{ data: org }, { data: tech }, photoUrls, parts] = await Promise.all([
    supabase.from('organizations').select('*').eq('id', orgId || '').single(),
    job.assigned_to
      ? supabase.from('profiles').select('display_name').eq('id', job.assigned_to).single()
      : Promise.resolve({ data: null as { display_name: string | null } | null }),
    listJobPhotoUrls(job.id),
    loadJobParts(job.id),
  ]);
  const [images, signatureImage] = await Promise.all([
    prepareReportImages(photoUrls, (org as any)?.logo_url),
    job.signature_url ? urlToDataUri(job.signature_url) : Promise.resolve(null),
  ]);
  const html = buildJobReportHtml(job, { ...(org as any), logo_url: images.logo || (org as any)?.logo_url }, {
    checklist: options.checklist,
    photos: images.photos,
    parts,
    technicianName: tech?.display_name,
    signatureImage,
  });
  // Loaded on demand: an app build made before expo-print was added then fails here (and the
  // caller skips the PDF) instead of failing when the screen opens.
  const Print = await import('expo-print');
  return Print.printToFileAsync({ html, base64: !!options.base64 });
}
