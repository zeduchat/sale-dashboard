"use client";

import ContactImport from "./ContactImport";

export function ContactImportScreen() {
  // Reload the server-rendered directory on return without remounting results.
  return (
    <ContactImport
      standalone
      onClose={() => window.location.assign("/contacts")}
    />
  );
}
