import EventOpsBanner from "../../EventOpsBanner";

export default function EventDetailLayout({ children }) {
  return (
    <>
      <EventOpsBanner />
      {children}
    </>
  );
}
