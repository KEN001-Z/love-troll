# Supabase integration

VYBE is a multi-page static site built with Vite. It uses the existing Supabase project `vhkzyasknygybugugjyl` in `eu-west-1`.

## Local development and deployment

1. Install dependencies with `npm install`.
2. Copy `.env.example` to `.env.local` and set `VITE_SUPABASE_URL` and `VITE_SUPABASE_PUBLISHABLE_KEY`. The URL and publishable key are browser-visible values. Never use a service-role key or secret key here.
3. Run `npm run dev` during development or `npm run build` for a static deployment. The output is in `dist/`.
4. Configure the deployed `login.html` and `reset.html` paths in Supabase Authentication → URL Configuration. For local development, use the Vite local origin. Configure the email templates/provider if email confirmation or password recovery messages need delivery.

Vite embeds `VITE_` variables in client assets at build time; configure the same variables in the hosting provider before building. `.env.local` is ignored by Git.

## Database

The connected project initially had no tables in `public`, no public RLS policies, and no migration history. Two additive migrations have now been applied:

- [supabase/migrations/20261011211437_create_vybe_profiles.sql](./supabase/migrations/20261011211437_create_vybe_profiles.sql) creates `public.profiles`, enables RLS, and limits select/insert/update to the authenticated owner (`auth.uid() = id`). It does not grant anonymous table access.
- [supabase/migrations/20261011212040_track_vybe_onboarding_progress.sql](./supabase/migrations/20261011212040_track_vybe_onboarding_progress.sql) adds the current onboarding step so unfinished flows resume where users left off.
- [supabase/migrations/20261011212100_add_discovery_and_mutual_matches.sql](./supabase/migrations/20261011212100_add_discovery_and_mutual_matches.sql) adds authenticated discovery of completed profiles, private outgoing interests, and participant-only mutual matches. Interests are recorded by an authenticated-only RPC; a match row is created only after reciprocal interest. Review and apply this migration to the connected project before using Discover.

The connected project's migration history currently records versions `20261011211437` and `20261011212040`. Apply the new discovery migration to that project, and apply all reviewed migrations to another environment with the Supabase migration workflow; do not rerun the existing migrations against the already-migrated VYBE project.

The current profile schema stores onboarding answers, interests, and intentions; it does not yet store profile photos, bios, age, or a written explanation for the Nigerian-food prompt. Discover therefore shows only the real profile data currently available, using an initial rather than an invented photo. Chat and community posts/polls/quizzes are not implemented by this discovery flow.

## User flow

Supabase Auth stores and refreshes browser sessions. Email confirmation is enabled and signup is allowed in the connected project; email delivery and redirect allow-lists still need to be configured and verified for the deployed origin. Logout explicitly revokes the current device's session, waits for Supabase to finish, and verifies the local session is cleared before leaving protected pages. If the server cannot confirm revocation but local sign-out succeeds, the user is informed rather than shown a success-shaped fallback. Onboarding choices and the current step are upserted as draft progress on each answer and navigation, then marked complete only after the final save succeeds. Returning users reload the saved answers and resume at the saved question.
