# DACOS public landing page

Open `/welcome` on the frontend development server. The existing `/` monitoring route and its authorization remain unchanged. Login buttons lead to `/login`; the login page links back to the landing page.

Edit content, team placeholders, contact details and styling in `frontend/src/views/LandingView.vue`. No team identities, phone numbers or email addresses are invented. Social links remain marked as pending until genuine URLs are supplied. The contact form validates fields locally but does not send or store messages; it clearly explains this before and after submission.

Photographs are bundled in `frontend/public/assets/landing/`:

- `mine-hero.jpg`: Munkh-Erdene Eenee, underground mine photograph, https://unsplash.com/photos/lrnc1AdZ8wA (image ID photo-1660748255246-80f24d317070).
- `engineering.jpg`: Unsplash industrial engineering photograph, image ID photo-1504307651254-35680f356dfd, https://images.unsplash.com/photo-1504307651254-35680f356dfd.

Stock photographs illustrate the industry; they do not depict DACOS equipment or a DACOS deployment. No hardware validation, safety certification or operational mine deployment is claimed.

The page uses no new dependencies, database models, backend endpoints or external message delivery. Public hosting has not been configured or performed as part of this change.
