/* Rendered into the drawer slot on every admin route that is not an
   intercepted lead — which is all of them, most of the time. A parallel route
   without a default fails to render on a hard load of any unmatched path. */

export default function NoDrawer() {
  return null;
}
