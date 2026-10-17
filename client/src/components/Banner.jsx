function Banner({ tone = "error", children, ...rest }) {
  if (!children) return null;
  return (
    <div
      className={`banner banner-${tone}`}
      role={tone === "error" ? "alert" : "status"}
      {...rest}
    >
      {children}
    </div>
  );
}

export default Banner;
