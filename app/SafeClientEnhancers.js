"use client";

import React from "react";
import LocationPinEnhancer from "./LocationPinEnhancer";
import EventDurationGuard from "./EventDurationGuard";
import EventPhotoExperience from "./EventPhotoExperience";
import LeadCaptureEnhancer from "./LeadCaptureEnhancer";
import EventFormHardening from "./EventFormHardening";
import ConfirmationPaymentCTA from "./ConfirmationPaymentCTA";

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
      <EnhancerBoundary name="LocationPinEnhancer">
        <LocationPinEnhancer />
      </EnhancerBoundary>
      <EnhancerBoundary name="EventDurationGuard">
        <EventDurationGuard />
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
      <EnhancerBoundary name="ConfirmationPaymentCTA">
        <ConfirmationPaymentCTA />
      </EnhancerBoundary>
    </>
  );
}
