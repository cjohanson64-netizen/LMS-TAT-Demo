type Props = {
  title: string;
  children: React.ReactNode;
};

export default function SectionCard({ title, children }: Props) {
  return (
    <section className="section-card">
      <h2>{title}</h2>
      {children}
    </section>
  );
}