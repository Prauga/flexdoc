type Theme = 'light' | 'dark';

export const themeClasses = (
  theme: Theme,
  classes: Record<Theme, string>
): string => {
  return classes[theme] || classes['light'];
};

export const themeVariant = (
  theme: Theme,
  light: string,
  dark: string
): string => {
  return theme === 'dark' ? dark : light;
};
