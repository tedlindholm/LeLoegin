import type { UmbContextBase } from '@umbraco-cms/backoffice/class-api';
import { UMB_NOTIFICATION_CONTEXT } from '@umbraco-cms/backoffice/notification';

/**
 * Peeks a toast notification via Umbraco's `UMB_NOTIFICATION_CONTEXT`.
 *
 * @param host - Context base providing `getContext`.
 * @param color - Notification colour (`'positive'` or `'danger'`).
 * @param message - Localised message to display.
 */
export async function notifyMessage(
	host: UmbContextBase,
	color: 'positive' | 'danger',
	message: string
): Promise<void> {
	const notificationContext = await host.getContext(UMB_NOTIFICATION_CONTEXT);
	notificationContext?.peek(color, { data: { message } });
}
