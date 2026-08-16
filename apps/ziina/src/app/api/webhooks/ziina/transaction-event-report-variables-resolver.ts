import { type SaleorMoney } from "@/modules/saleor/saleor-money";
import { type SaleorTransationId } from "@/modules/saleor/saleor-transaction-id";
import { type TransactionEventReportInput } from "@/modules/saleor/transaction-event-reporter";
import { type ChargeActionRequiredResult } from "@/modules/transaction-result/action-required-result";
import { type ChargeFailureResult } from "@/modules/transaction-result/failure-result";
import {
  type RefundFailureResult,
  type RefundRequestResult,
  type RefundSuccessResult,
} from "@/modules/transaction-result/refund-result";
import { type ChargeRequestResult } from "@/modules/transaction-result/request-result";
import { type ChargeSuccessResult } from "@/modules/transaction-result/success-result";
import { type ZiinaPaymentIntentId } from "@/modules/ziina/ziina-payment-intent-id";
import { type ZiinaRefundId } from "@/modules/ziina/ziina-refund-id";

type ZiinaWebhookTransactionResult =
  | ChargeSuccessResult
  | ChargeActionRequiredResult
  | ChargeRequestResult
  | ChargeFailureResult
  | RefundSuccessResult
  | RefundFailureResult
  | RefundRequestResult;

export class TransactionEventReportVariablesResolver {
  readonly saleorTransactionId: SaleorTransationId;
  readonly timestamp: Date;
  readonly transactionResult: ZiinaWebhookTransactionResult;
  readonly saleorMoney: SaleorMoney;
  readonly pspReference: ZiinaPaymentIntentId | ZiinaRefundId;
  readonly externalUrl: string;

  constructor(args: {
    saleorTransactionId: SaleorTransationId;
    timestamp: Date;
    transactionResult: ZiinaWebhookTransactionResult;
    saleorMoney: SaleorMoney;
    pspReference: ZiinaPaymentIntentId | ZiinaRefundId;
    externalUrl: string;
  }) {
    this.timestamp = args.timestamp;
    this.saleorTransactionId = args.saleorTransactionId;
    this.transactionResult = args.transactionResult;
    this.saleorMoney = args.saleorMoney;
    this.pspReference = args.pspReference;
    this.externalUrl = args.externalUrl;
  }

  resolveEventReportVariables(): TransactionEventReportInput {
    return {
      transactionId: this.saleorTransactionId,
      amount: this.saleorMoney,
      type: this.transactionResult.result,
      message: this.transactionResult.message,
      time: this.timestamp.toISOString(),
      pspReference: this.pspReference,
      actions: this.transactionResult.actions,
      externalUrl: this.externalUrl,
      saleorPaymentMethodDetailsInput: null,
    };
  }
}
