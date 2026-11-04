# Flashback Retro Photobooth

A responsive, browser-based retro photobooth and photo editor built with plain HTML, CSS, and JavaScript. Vercel serves the static site and API routes; Supabase stores guest-share photos in a private bucket.

## Run locally

Open `index.html` in a browser, or serve this folder from a local web server. Camera access requires HTTPS or `localhost` and the visitor's permission. Uploads work when camera access is unavailable.

The local gallery works without a backend, but creating guest codes requires the Vercel API and Supabase setup below.

## Enable private guest codes on Vercel

1. Create a Supabase project and a **private** Storage bucket named `flashback-memories`. Set the bucket's maximum file size to 3 MB and allow JPEG, PNG, and WebP files.
2. In the Supabase SQL editor, create the access-code table:

   ```sql
   create table if not exists public.flashback_memories (
     id uuid primary key,
     code_hash text not null unique,
     title text not null,
     object_path text not null unique,
     created_at timestamptz not null,
     expires_at timestamptz not null
   );

   alter table public.flashback_memories enable row level security;
   revoke all on public.flashback_memories from anon, authenticated;
   grant all on public.flashback_memories to service_role;
   create index if not exists flashback_memories_expires_at_idx
     on public.flashback_memories (expires_at);

   insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
   values (
     'flashback-memories',
     'flashback-memories',
     false,
     3145728,
     array['image/jpeg', 'image/png', 'image/webp']
   )
   on conflict (id) do update set
     public = false,
     file_size_limit = 3145728,
     allowed_mime_types = excluded.allowed_mime_types;
   ```

3. In the Vercel project settings, add these environment variables for the deployment:
   - `SUPABASE_URL` — the Supabase project URL.
   - `SUPABASE_SERVICE_ROLE_KEY` — the Supabase service-role key. Keep it server-side; never add it to frontend code.
   - `CRON_SECRET` — a long random secret used to authorize Vercel's expired-photo cleanup job.
4. Deploy the project on Vercel. Each photobooth shot is uploaded to the private bucket as it is captured and immediately gets its own random 24-hour access code, before you save or download the strip. The code appears on screen so you can note it and give it to that photo's guest. Give each guest this link: `https://YOUR-VERCEL-DOMAIN/pages/access.html`; they can open it on any device and enter their code. The editor also creates a code when you save an edited photo.

The guest code is stored hashed in the database; photo reads require a valid, unexpired code and use a short-lived signed image URL. Expired photos are removed by the daily Vercel cron job. The local Gallery remains browser-specific and is not the guest-access page. Guest codes are bearer secrets: share each only with its intended recipient.

## Features

- Responsive home, photobooth, editor, gallery, frames and stickers, about, help, and guest-code pages.
- Camera capture with a timer, one/two/three/four-photo layouts, eight retro filters, frames, and individual photo saves.
- Photo editing with upload, crop ratios, zoom, rotation, brightness, contrast, filters, frames, stickers, and date labels.
- Saved photos can be viewed, downloaded, searched, filtered, or removed from the local gallery.
- The photobooth immediately displays every successful guest code in a prominent on-screen panel with expiry time and a copy button; the same codes are listed in the A4 print preview.
- The front end does not send guest codes to a QR-code image service.

## Project structure

- `index.html` and `pages/` contain the site pages.
- `css/` contains shared, page-specific, and responsive styles.
- `js/` contains navigation, camera, editor, gallery, storage, and guest access behavior.
- `api/` contains Vercel serverless functions for private photo creation, access, and cleanup.
- `lib/supabase.js` contains server-only Supabase REST helpers.

Locally saved images use browser storage and may reach its quota. Guest sharing uploads a resized copy (up to 3 MB) to Supabase; the booth device keeps its local gallery copy. The Supabase service-role key must never be exposed to visitors.
