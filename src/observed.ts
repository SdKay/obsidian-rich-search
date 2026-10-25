/**
 * One watch per target, started the first time the target is seen and stopped when it is no longer
 * wanted. Asking again for a target that is already watched does nothing, so a refresh that runs on
 * every layout change never piles up watchers.
 */
export class Watches<T extends object> {
	private active = new Map<T, () => void>();

	/** `start` begins watching a target and returns the function that stops it. */
	constructor(private readonly start: (target: T) => () => void) {}

	get size(): number {
		return this.active.size;
	}

	ensure(target: T): void {
		if (!this.active.has(target)) this.active.set(target, this.start(target));
	}

	/** Stops the watches on every target not in `wanted`. */
	keepOnly(wanted: readonly T[]): void {
		const keep = new Set(wanted);
		for (const [target, stop] of [...this.active]) {
			if (keep.has(target)) continue;
			this.active.delete(target);
			this.stopSafely(stop);
		}
	}

	stopAll(): void {
		this.keepOnly([]);
	}

	private stopSafely(stop: () => void): void {
		try {
			stop();
		} catch (err) {
			console.error('Rich Search: stopping a watch failed', err);
		}
	}
}
