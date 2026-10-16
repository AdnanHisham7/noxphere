// src/features/guardian/GuardianComplaintsPage.tsx
import React from "react";
import { NoxPageHeader } from "../../components/portal-ui";
import { FileComplaintWidget } from "../complaints/FileComplaintWidget";

const GuardianComplaintsPage: React.FC = () => {
  return (
    <div className="space-y-6">
      <NoxPageHeader
        eyebrow="Guardian portal"
        title="Complaints & Support"
        subtitle="Submit feedback, report concerns, or communicate directly with academy management and coaching staff."
      />
      <FileComplaintWidget />
    </div>
  );
};

export default GuardianComplaintsPage;