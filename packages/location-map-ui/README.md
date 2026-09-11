# Location map UI

This package extracts the existing Axis `LocationPopupContent` and its styles.
Axis and Circa import this same component; neither owns a second popup renderer.
The source is maintained here in the Axis repository. This is frontend rendering,
not a Nodics backend module or a configuration store.

Consumers supply a centre name, scalar coordinates, the Location-configured map
category, optional directions origin, the backend directions-control flag and a
close callback. The existing Axis category summary and directions behavior are
preserved. Provider popup positioning remains in each map adapter.

For a portable local release, run `npm pack` in this directory. Circa checks in
the generated package archive under `vendor/` and installs it through its normal
package manifest, so cloning Circa does not require a local Axis checkout.
Rebuild the archive when this source changes; do not edit distributed copies.
This package can later use a normal package registry without changing consumers.
