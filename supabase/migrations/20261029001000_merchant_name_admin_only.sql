-- An approved merchant keeps editing description and contact details, but renaming the business
-- would bypass the admin review that approved it: business_name is now set only at application.
revoke update (business_name) on public.merchant_profiles from authenticated;
