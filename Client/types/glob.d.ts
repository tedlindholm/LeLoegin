interface ShadowRoot {
	getSelection(): Selection | null;
}

interface NavigatorUABrandVersion {
	brand: string;
	version: string;
}

interface NavigatorUAData {
	brands: NavigatorUABrandVersion[];
	mobile: boolean;
	platform: string;
}

interface Navigator {
	userAgentData: NavigatorUAData;
}
