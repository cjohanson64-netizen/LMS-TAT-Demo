type Props = {
  message: string;
};

export default function SuccessMessage({ message }: Props) {
  if (!message) return null;
  return <p className="success-message">{message}</p>;
}