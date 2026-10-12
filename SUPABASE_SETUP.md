# Supabase integration

VYBE is a multi-page static site built with Vite. It uses the existing Supabase project `vhkzyasknygybugugjyl` in `eu-west-1`.

## Local development and deployment

1. Install dependencies with `npm install`.
2. Copy `.env.example` to `.env.local` and set `VITE_SUPABASE_URL` and `VITE_SUPABASE_PUBLISHABLE_KEY`. The URL and publishable key are browser-visible values. Never use a service-role key or secret key here.
3. Run `npm run dev` during development and open the Vite URL it prints (normally `http://localhost:5173`). Do not use VS Code Live Server to open the source HTML directly: it does not resolve the Supabase package or inject the Vite environment variables. Run `npm run build` for a static deployment; the output is in `dist/`.
4. Configure the deployed origin and the `login.html`, `onboarding.html`, and `reset.html` paths in Supabase Authentication → URL Configuration. For local development, allow the Vite origins `http://localhost:5173/**` and `http://127.0.0.1:5173/**`. Configure the email templates/provider if email confirmation or password recovery messages need delivery.

Vite embeds `VITE_` variables in client assets at build time; configure the same variables in the hosting provider before building. `.env.local` is ignored by Git.

## Google sign-in

Google sign-in is available on both the login and signup pages. Before users can use it, create a **Web application** OAuth client in Google Cloud, add the local and deployed site origins as authorized JavaScript origins, and add the callback URL shown in Supabase Authentication → Providers → Google as an authorized redirect URI in Google Cloud. Then enable Google in that Supabase provider settings page and enter the Google client ID and client secret there. Keep the client secret in Supabase; it does not belong in `.env.local` or browser code. Also allow the deployed `login.html` and `onboarding.html` redirect URLs in Supabase Authentication → URL Configuration. Signup with Google still requires users to confirm they are 18 or older and accept the VYBE terms before redirecting to Google.

## Database

The connected project initially had no tables in `public`, no public RLS policies, and no migration history. Its base profile and onboarding migrations were already applied. The discovery and student-profile migrations are now applied to the connected VYBE project; run them in this order when setting up another environment:

- [supabase/migrations/20261011211437_create_vybe_profiles.sql](./supabase/migrations/20261011211437_create_vybe_profiles.sql) creates `public.profiles`, enables RLS, and limits select/insert/update to the authenticated owner (`auth.uid() = id`). It does not grant anonymous table access.
- [supabase/migrations/20261011212040_track_vybe_onboarding_progress.sql](./supabase/migrations/20261011212040_track_vybe_onboarding_progress.sql) adds the current onboarding step so unfinished flows resume where users left off.
- [supabase/migrations/20261012103008_add_discovery_and_mutual_matches.sql](./supabase/migrations/20261012103008_add_discovery_and_mutual_matches.sql) adds authenticated discovery of completed profiles, private outgoing interests, and participant-only mutual matches. Interests are recorded by an authenticated-only RPC; a match row is created only after reciprocal interest.
- [supabase/migrations/20261012103403_add_student_profiles.sql](./supabase/migrations/20261012103403_add_student_profiles.sql) adds student profile details, private profile media, explicit matchmaking opt-in, and privacy-aware profile/discovery RPCs. Apply it after the discovery migration. Direct profile-table reads are owner-only; public and matched profiles are returned through guarded RPCs.
- [supabase/migrations/20261012105101_remove_generated_profile_usernames.sql](./supabase/migrations/20261012105101_remove_generated_profile_usernames.sql) removes UUID-derived placeholder usernames. A username is now shown only after the student chooses one.
- [supabase/migrations/20261012105254_fix_generated_profile_usernames.sql](./supabase/migrations/20261012105254_fix_generated_profile_usernames.sql) corrects the cleanup migration's trigger ordering so existing UUID-derived usernames are actually cleared.

The connected project's migration history records versions `20261011211437`, `20261011212040`, `20261012103008`, `20261012103403`, `20261012105101`, and `20261012105254`. Apply reviewed migrations to another environment with the Supabase migration workflow; do not rerun existing migrations against an already-migrated VYBE project.

The student-profile migration adds profile photos, bio, education details, optional interests and tags, and visibility settings. Profile IDs are the authenticated Supabase Auth user UUIDs; the profile page uses `auth.getUser()` to identify the signed-in owner and fetches that owner’s row by the same UUID. Other profile IDs come from persisted profile rows and are checked by the database RPC against the current authenticated user and visibility rules. Names come from saved profile data or the owner’s Auth display-name metadata; usernames are never generated from IDs. Profile media uses a private `profile-media` bucket and only becomes accessible to the owner, a campus-visible audience, or a mutual match. Age is not stored or verified. Posts, follows, messages, reporting/blocking, and campus competitions still do not have backend tables or workflows; the profile page identifies these as unavailable rather than fabricating activity or counts.

## User flow

Supabase Auth stores and refreshes browser sessions. If Supabase rejects a stored session (including an invalid refresh token), VYBE clears that project's local auth entries and asks the user to log in again; network errors are not treated as expired-session recovery. Login checks the authenticated user's existing profile before routing to the homepage or onboarding. Signup initializes a missing profile without overwriting an existing one and routes authenticated users to onboarding. Email confirmation is enabled in the connected project, so users must confirm their address before a session can be created; the confirmation link returns to onboarding. Email delivery and redirect allow-lists still need to be configured and verified for the deployed origin. Logout explicitly revokes the current device's session, waits for Supabase to finish, and verifies the local session is cleared before leaving protected pages. If the server cannot confirm revocation but local sign-out succeeds, the user is informed rather than shown a success-shaped fallback. Onboarding choices and the current step are upserted as draft progress on each answer and navigation, then marked complete only after the final save succeeds and the user is redirected to the homepage. Returning users reload the saved answers and resume at the saved question.
