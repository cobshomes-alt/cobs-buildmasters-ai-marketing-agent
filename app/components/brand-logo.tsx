export default function BrandLogo({
  placement,
}: {
  placement: "sidebar" | "auth" | "hero";
}) {
  return (
    <div className={`company-brand company-brand--${placement}`}>
      <img
        src="/branding/cobs-buildmasters-logo.jpeg"
        width={1280}
        height={1280}
        alt="COBS BUILDMASTERS LTD — Concrete Blocks · Fast Floors · Construction"
        className="company-logo"
      />
      {placement !== "hero" && (
        <span className="company-brand-caption">MARKETING AGENT</span>
      )}
    </div>
  );
}
