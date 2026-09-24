export interface UserProfile {
  id: string;
  full_name: string | null;
  /** Contact and sign-in address, kept with the profile on the device. */
  email?: string | null;
  /** The handle in the shared profile link, fit.qla.dev/<username>. */
  username?: string | null;
  phone_number: string | null;
  date_of_birth: string | null;
  bio: string | null;
  avatar_url: string | null;
  gender: 'male' | 'female' | null;
}
