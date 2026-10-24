# Choosing essential scenarios

Read this when identifying which emails a product needs. The table is a
discovery aid, not a requirement to implement every row. Establish each trigger,
recipient, supporting product behavior, user action, and source of truth before
calling a notice implemented or essential.

| Group | Candidate notice | What the design must make clear |
| --- | --- | --- |
| Login and security | Email confirmation | Why confirmation is needed; link expiry and single-use behavior if supported; what to do if not requested |
| Login and security | Sign-in code or magic link | Supported sign-in mechanism, expiry, no sharing, and unsolicited-request guidance |
| Login and security | Password reset | Request received versus password actually changed; recovery action and expiry |
| Login and security | Password changed | Change confirmation and a concrete recovery path if unauthorized |
| Payments and subscriptions | Subscription active | Confirmed activation state, relevant plan/access details, and where receipts or invoices actually come from |
| Payments and subscriptions | Failed renewal | Failed payment, required action, and verified grace/access limits; never collect card details by email |
| Payments and subscriptions | Cancellation confirmed | Cancellation versus disabled renewal, effective date, remaining access, and distinction from account deletion |
| Team access | Invitation | Inviter/workspace, intended role, expiry, and intended recipient account |
| Connections and operations | Reconnection required | Affected account and work, action needed, and whether previously failed work must be recovered separately |
| Connections and operations | Operation failed | Known failure, preserved work, cause if known, and explicit recovery action |
| Connections and operations | Outcome unconfirmed | Unknown outcome versus failure; check current state before repeating an operation that may already have succeeded |
| Account privacy | Deletion requested | Request/disabled/deleted state, verified restoration and deletion deadlines, and effects on related work or subscriptions |

Welcome campaigns, setup reminders, digests, referrals, reports, and approval
requests are not automatically part of this set. Include them when requested
and when the product's actual workflow makes them relevant. A requested report
notification may be essential for one product even though absent from another.

## Do not invent lifecycle promises

Dates and amounts can remain `{{named_placeholders}}`. Statements about behavior
also need evidence: restoring an account, retrying a post, stopping renewal,
retaining content, or sending a separate payment receipt are product-specific.
If behavior is undecided, label the design assumption in the handoff and avoid
claiming production support. A placeholder deadline does not validate the
surrounding lifecycle claim.

Distinguish transactional notices from marketing in both content and delivery
requirements. Do not copy a competitor's subscription footer into security mail
or remove consent/unsubscribe handling from actual marketing mail.
