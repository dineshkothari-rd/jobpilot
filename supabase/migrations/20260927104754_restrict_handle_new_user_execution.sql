-- handle_new_user is invoked by the auth.users trigger.
-- It must not be directly callable through the Data API/RPC.

revoke execute on function public.handle_new_user() from public;
revoke execute on function public.handle_new_user() from anon;
revoke execute on function public.handle_new_user() from authenticated;
