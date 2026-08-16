type PaymentResultPageProps = {
  searchParams: Promise<{
    [key: string]: string | string[] | undefined;
  }>;
};

export default async function PaymentResultPage({ searchParams }: PaymentResultPageProps) {
  const params = await searchParams;
  const status = typeof params.status === "string" ? params.status : undefined;
  const paymentIntentId =
    typeof params.paymentIntentId === "string" ? params.paymentIntentId : undefined;

  const getMessage = () => {
    switch (status) {
      case "success":
        return "Payment completed";
      case "cancel":
        return "Payment was cancelled";
      case "failure":
        return "Payment failed";
      default:
        return "Payment status unknown";
    }
  };

  return (
    <main>
      <h1>{getMessage()}</h1>
      {paymentIntentId ? <p>Payment intent: {paymentIntentId}</p> : null}
      <p>You can close this page and return to the store.</p>
    </main>
  );
}
