// Public browser configuration. Never put a service_role key, database password,
// access token or sb_secret_ key here. See docs/SHARED-GROUPS.md.
export const cloudConfig = {
  url: 'https://xvtqmmpufvmyuokpmjvf.supabase.co',
  publishableKey: 'sb_publishable_M3FoBLgEf8lVqAHVRY4bnw_1rscB6lC',
  // Optional browser/TWA preflight; activate only after staging the backend.
  // Does not enforce OAuth signup restrictions. Secret Key: Supabase secrets only.
  oauthProtection: {enabled:false,siteKey:'0x4AAAAAAGIzOswUgGy61ea9'},
  // Route Google through the trusted broker only after its staging acceptance.
  googleBroker: {enabled:false}
};
