// src/features/guardian/GuardianComplaintsPage.tsx
import React from "react";
import { FileComplaintWidget } from "../complaints/FileComplaintWidget";

const GuardianComplaintsPage: React.FC = () => {
  return (
    <div>
      <h1 className="font-orbital text-xl font-semibold text-nox-high mb-6">Complaints</h1>
      <FileComplaintWidget />
    </div>
  );
};

export default GuardianComplaintsPage;