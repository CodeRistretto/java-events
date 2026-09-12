"use client";

import React from "react";
import LocationPinEnhancer from "./LocationPinEnhancer";
import MapVisibilityEnhancer from "./MapVisibilityEnhancer";
import EventDurationGuard from "./EventDurationGuard";
import CalendarAvailabilityEnhancer from "./CalendarAvailabilityEnhancer";
import EventPhotoExperience from "./EventPhotoExperience";
import LeadCaptureEnhancer from "./LeadCaptureEnhancer";
import EventFormHardening from "./EventFormHardening";
import QuoteFlowWizard from "./QuoteFlowWizard";
import StatusToastEnhancer from "./StatusToastEnhancer";
import ConfirmationPaymentCTA from "./ConfirmationPaymentCTA";
import PublicCopyEnhancer from "./PublicCopyEnhancer";
import LoadingExperience from "./LoadingExperience";
import ElevatorAccessCleanup from "./ElevatorAccessCleanup";
import EmbedAutoOpen from "./EmbedAutoOpen";

class EnhancerBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { failed: false };
  }

  static getDerivedStateFromError() {
    return { failed: true };
  }

  componentDidCatch(error) {
    console.error(`Java Events enhancer failed: ${this.props.name}`, error);
  }

  render() {
    if (this.state.failed) return null;
    return this.props.children;
  }
}

export default function SafeClientEnhancers() {
  return (
    <>
      <EnhancerBoundary name="LoadingExperience">
        <LoadingExperience />
      </EnhancerBoundary>
      <EnhancerBoundary name="PublicCopyEnhancer">
        <PublicCopyEnhancer />
      </EnhancerBoundary>
      <EnhancerBoundary name="ElevatorAccessCleanup">
        <ElevatorAccessCleanup />
      </EnhancerBoundary>
      <EnhancerBoundary name="LocationPinEnhancer">
        <LocationPinEnhancer />
      </EnhancerBoundary>
      <EnhancerBoundary name="MapVisibilityEnhancer">
        <MapVisibilityEnhancer />
      </EnhancerBoundary>
      <EnhancerBoundary name="EventDurationGuard">
        <EventDurationGuard />
      </EnhancerBoundary>
      <EnhancerBoundary name="CalendarAvailabilityEnhancer">
        <CalendarAvailabilityEnhancer />
      </EnhancerBoundary>
      <EnhancerBoundary name="EventPhotoExperience">
        <EventPhotoExperience />
      </EnhancerBoundary>
      <EnhancerBoundary name="LeadCaptureEnhancer">
        <LeadCaptureEnhancer />
      </EnhancerBoundary>
      <EnhancerBoundary name="EventFormHardening">
        <EventFormHardening />
      </EnhancerBoundary>
      <EnhancerBoundary name="QuoteFlowWizard">
        <QuoteFlowWizard />
      </EnhancerBoundary>
      <EnhancerBoundary name="EmbedAutoOpen">
        <EmbedAutoOpen />
      </EnhancerBoundary>
      <EnhancerBoundary name="StatusToastEnhancer">
        <StatusToastEnhancer />
      </EnhancerBoundary>
      <EnhancerBoundary name="ConfirmationPaymentCTA">
        <ConfirmationPaymentCTA />
      </EnhancerBoundary>
    </>
  );
}
