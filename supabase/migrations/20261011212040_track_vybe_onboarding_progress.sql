alter table public.profiles
  add column onboarding_step smallint not null default 0
  constraint profiles_onboarding_step_valid check (onboarding_step between 0 and 5);
