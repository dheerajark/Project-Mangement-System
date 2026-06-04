'use client';

import React, { Suspense } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { useAuth } from '@/hooks/useAuth';
import { useRouter, useSearchParams } from 'next/navigation';
import { KeyRound, AlertCircle, Loader2, User } from 'lucide-react';
import Link from 'next/link';

const acceptInviteSchema = z.object({
  password: z.string().min(6, 'Password must be at least 6 characters'),
  firstName: z.string().min(1, 'First name is required'),
  lastName: z.string().min(1, 'Last name is required'),
});

type AcceptInviteFormValues = z.infer<typeof acceptInviteSchema>;

function AcceptInviteForm() {
  const { acceptInvite, isAcceptingInvite } = useAuth();
  const router = useRouter();
  const searchParams = useSearchParams();
  const token = searchParams.get('token');
  const [error, setError] = React.useState<string | null>(null);

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<AcceptInviteFormValues>({
    resolver: zodResolver(acceptInviteSchema),
  });

  if (!token) {
    return (
      <div className="w-full max-w-md bg-slate-900/60 backdrop-blur-xl border border-slate-800 rounded-2xl p-8 shadow-2xl relative z-10 text-center">
        <AlertCircle className="w-12 h-12 text-red-500 mx-auto mb-4 animate-bounce" />
        <h1 className="text-2xl font-bold text-slate-100">Invalid Invitation Link</h1>
        <p className="text-slate-400 text-sm mt-3">
          The invitation link you followed is missing the required secure security token. Please ask your administrator for a new link.
        </p>
        <div className="mt-8 border-t border-slate-800 pt-6">
          <Link href="/login" className="text-indigo-400 hover:text-indigo-300 font-semibold text-sm transition-colors duration-150">
            Return to Login
          </Link>
        </div>
      </div>
    );
  }

  const onSubmit = async (values: AcceptInviteFormValues) => {
    setError(null);
    try {
      await acceptInvite({
        token,
        password: values.password,
        firstName: values.firstName,
        lastName: values.lastName,
      });
      router.push('/dashboard');
    } catch (err: any) {
      setError(
        err.response?.data?.message ||
          'Failed to join organization. The invitation may be invalid, expired, or already accepted.'
      );
    }
  };

  return (
    <div className="w-full max-w-md bg-slate-900/60 backdrop-blur-xl border border-slate-800 rounded-2xl p-8 shadow-2xl relative z-10 hover:border-slate-700/80 transition-all duration-300">
      <div className="text-center mb-8">
        <h1 className="text-3xl font-extrabold tracking-tight bg-gradient-to-r from-indigo-400 via-blue-400 to-indigo-400 bg-clip-text text-transparent">
          Join Organization
        </h1>
        <p className="text-slate-400 text-sm mt-2">
          Setup your profile details and password to accept the invitation
        </p>
      </div>

      {error && (
        <div className="mb-6 bg-red-950/50 border border-red-800 text-red-200 text-sm p-4 rounded-xl flex items-center gap-3">
          <AlertCircle className="w-5 h-5 text-red-400 flex-shrink-0" />
          <span>{error}</span>
        </div>
      )}

      <form onSubmit={handleSubmit(onSubmit)} className="space-y-5">
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-2">
              First Name
            </label>
            <div className="relative">
              <User className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
              <input
                type="text"
                placeholder="Jane"
                {...register('firstName')}
                className="w-full pl-9 pr-3 py-2.5 bg-slate-950/80 border border-slate-800 rounded-xl text-slate-100 placeholder-slate-500 focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 transition-all duration-200 text-sm"
              />
            </div>
            {errors.firstName && (
              <p className="text-red-400 text-xs mt-1">
                {errors.firstName.message}
              </p>
            )}
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-2">
              Last Name
            </label>
            <div className="relative">
              <User className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
              <input
                type="text"
                placeholder="Doe"
                {...register('lastName')}
                className="w-full pl-9 pr-3 py-2.5 bg-slate-950/80 border border-slate-800 rounded-xl text-slate-100 placeholder-slate-500 focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 transition-all duration-200 text-sm"
              />
            </div>
            {errors.lastName && (
              <p className="text-red-400 text-xs mt-1">
                {errors.lastName.message}
              </p>
            )}
          </div>
        </div>

        <div>
          <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-2">
            Create Password
          </label>
          <div className="relative">
            <KeyRound className="absolute left-3.5 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-500" />
            <input
              type="password"
              placeholder="••••••••"
              {...register('password')}
              className="w-full pl-11 pr-4 py-3 bg-slate-950/80 border border-slate-800 rounded-xl text-slate-100 placeholder-slate-500 focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 transition-all duration-200"
            />
          </div>
          {errors.password && (
            <p className="text-red-400 text-xs mt-1.5 ml-1">
              {errors.password.message}
            </p>
          )}
        </div>

        <button
          type="submit"
          disabled={isAcceptingInvite}
          className="w-full py-3 bg-gradient-to-r from-indigo-600 to-blue-600 hover:from-indigo-500 hover:to-blue-500 text-white rounded-xl font-semibold shadow-lg shadow-indigo-500/20 active:scale-[0.98] transition-all duration-150 flex items-center justify-center gap-2 disabled:opacity-50"
        >
          {isAcceptingInvite ? (
            <>
              <Loader2 className="w-5 h-5 animate-spin" />
              Accepting invitation...
            </>
          ) : (
            'Join Organization'
          )}
        </button>
      </form>

      <div className="text-center mt-8 border-t border-slate-800/80 pt-6">
        <p className="text-slate-400 text-sm">
          Already have an account?{' '}
          <Link href="/login" className="text-indigo-400 hover:text-indigo-300 font-semibold transition-colors duration-150">
            Sign in
          </Link>
        </p>
      </div>
    </div>
  );
}

export default function AcceptInvitePage() {
  return (
    <div className="min-h-screen w-full flex items-center justify-center bg-slate-950 relative overflow-hidden px-4">
      {/* Background Gradients */}
      <div className="absolute top-[-20%] left-[-10%] w-[50%] h-[50%] rounded-full bg-indigo-500/10 blur-[120px]" />
      <div className="absolute bottom-[-20%] right-[-10%] w-[50%] h-[50%] rounded-full bg-blue-500/10 blur-[120px]" />

      <Suspense fallback={
        <div className="text-slate-300 flex flex-col items-center gap-3">
          <Loader2 className="w-8 h-8 animate-spin text-indigo-500" />
          <span>Loading invitation details...</span>
        </div>
      }>
        <AcceptInviteForm />
      </Suspense>
    </div>
  );
}
