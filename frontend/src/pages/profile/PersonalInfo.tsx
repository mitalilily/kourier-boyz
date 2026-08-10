import { useProfile, useResendProfilePhoneOTP, useSendUpdateOTP, useUpdateProfile } from "@/api/auth";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { DatePicker } from "@/components/ui/date-picker";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { FieldError, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import {
  InputOTP,
  InputOTPGroup,
  InputOTPSlot,
} from "@/components/ui/input-otp";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Calendar, Edit, Mail, Phone, User, Receipt } from "lucide-react";
import { useEffect, useState } from "react";
import { Controller, useForm } from "react-hook-form";
import { useSearchParams } from "react-router-dom";
import { toast } from "sonner";

interface VerificationFormData {
  emailOTP?: string;
  phoneOTP?: string;
}

const PersonalInfo = () => {
  const { data: profile } = useProfile();
  const updateProfile = useUpdateProfile();
  const sendOTP = useSendUpdateOTP();
  const resendPhoneOTP = useResendProfilePhoneOTP();
  const [searchParams] = useSearchParams();
  const [resendCooldown, setResendCooldown] = useState(0);
  const [isEditingName, setIsEditingName] = useState(false);
  const [isEditingEmail, setIsEditingEmail] = useState(false);
  const [isEditingPhone, setIsEditingPhone] = useState(false);
  const [isEditingDateOfBirth, setIsEditingDateOfBirth] = useState(false);
  const [isEditingGender, setIsEditingGender] = useState(false);
  const [isEditingGst, setIsEditingGst] = useState(false);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [dateOfBirth, setDateOfBirth] = useState<Date | undefined>(undefined);
  const [gender, setGender] = useState<
    "male" | "female" | "other" | "prefer-not-to-say" | ""
  >("");
  const [gstNumber, setGstNumber] = useState("");
  const [avatarError, setAvatarError] = useState(false);

  // Verification modal state
  const [showVerificationModal, setShowVerificationModal] = useState(false);
  const [pendingUpdate, setPendingUpdate] = useState<{
    field: "email" | "phone";
    value: string;
  } | null>(null);

  const verificationForm = useForm<VerificationFormData>({
    defaultValues: {
      emailOTP: "",
      phoneOTP: "",
    },
    mode: "onChange",
  });

  // Reset avatar error when profile changes
  useEffect(() => {
    if (profile?.avatar || profile?.profilePicture || profile?.profilePhoto) {
      setAvatarError(false);
    }
  }, [profile?.avatar, profile?.profilePicture, profile?.profilePhoto]);

  // Cooldown timer for resend OTP
  useEffect(() => {
    if (resendCooldown > 0) {
      const timer = setInterval(() => {
        setResendCooldown((prev) => (prev > 0 ? prev - 1 : 0));
      }, 1000);
      return () => clearInterval(timer);
    }
  }, [resendCooldown]);

  // Reset cooldown when modal opens
  useEffect(() => {
    if (showVerificationModal && pendingUpdate?.field === "phone") {
      setResendCooldown(0);
    }
  }, [showVerificationModal, pendingUpdate?.field]);

  // Check if phone verification is needed (from OAuth signup)
  useEffect(() => {
    const verifyPhoneParam = searchParams.get("verify_phone");
    if (
      verifyPhoneParam === "true" &&
      profile &&
      !profile.isPhoneVerified &&
      !isEditingPhone
    ) {
      // Prompt user to add and verify phone
      if (!profile.phone) {
        toast.info(
          "Please add and verify your phone number to complete your account setup"
        );
        setIsEditingPhone(true);
        setPhone("");
      } else {
        toast.info(
          "Please verify your phone number to complete your account setup"
        );
        // Phone is masked in profile, so prompt user to enter it
        setIsEditingPhone(true);
        setPhone("");
      }
      // Remove query param
      window.history.replaceState({}, "", window.location.pathname);
    }
  }, [searchParams, profile, isEditingPhone, sendOTP]);

  if (!profile) return null;

  const handleEditName = () => {
    if (isEditingName) {
      // Save
      const trimmedName = name.trim();

      if (!trimmedName || trimmedName.length < 2) {
        toast.error("Name must be at least 2 characters long");
        return;
      }

      if (trimmedName !== profile.name) {
        updateProfile.mutate({ name: trimmedName });
      }
      setIsEditingName(false);
      setName("");
    } else {
      // Start editing
      setName(profile.name || "");
      setIsEditingName(true);
    }
  };

  const handleEditPhone = () => {
    if (isEditingPhone) {
      const trimmedPhone = phone.trim();
      const digitsOnly = trimmedPhone.replace(/\D/g, "");

      if (!digitsOnly) {
        setIsEditingPhone(false);
        setPhone("");
        return;
      }

      if (!/^[6-9]\d{9}$/.test(digitsOnly)) {
        toast.error(
          "Please enter a valid 10-digit Indian mobile number starting with 6, 7, 8, or 9"
        );
        return;
      }

      const normalizedPhone = digitsOnly;
      
      // Get the initial phone value (what was shown when editing started)
      // If phone is masked or not available, we need to verify
      const hasExistingPhone = !!profile.phone && !profile.phone.includes('*');
      const existingPhoneDigits = hasExistingPhone && profile.phone
        ? profile.phone.replace(/\D/g, "") 
        : "";
      
      // Always require verification if:
      // 1. No existing phone
      // 2. Existing phone is not verified
      // 3. New phone is different from existing phone (phone number changed)
      const phoneChanged = hasExistingPhone && existingPhoneDigits !== normalizedPhone;
      const needsVerification = !hasExistingPhone || !profile.isPhoneVerified || phoneChanged;

      if (needsVerification) {
        // Always send OTP to the new phone number when it changes
        setPendingUpdate({ field: "phone", value: normalizedPhone });
        sendOTP.mutate(
          { phone: normalizedPhone },
          {
            onSuccess: () => {
              verificationForm.reset();
              setShowVerificationModal(true);
            },
          }
        );
      } else {
        // Phone hasn't changed and is already verified - just exit edit mode
        setIsEditingPhone(false);
        setPhone("");
      }
    } else {
      // When starting to edit, clear the input if phone is masked
      const phoneToShow = profile.phone && !profile.phone.includes('*') ? profile.phone : "";
      setPhone(phoneToShow);
      setIsEditingPhone(true);
    }
  };

  const handleEditEmail = () => {
    if (isEditingEmail) {
      const trimmedEmail = email.trim();

      // Basic email format validation
      const emailPattern = /^[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}$/i;
      if (!emailPattern.test(trimmedEmail)) {
        toast.error("Please enter a valid email address");
        return;
      }

      const existingEmail = profile.email || "";
      const hasChanged = trimmedEmail && trimmedEmail !== existingEmail;
      const needsVerification =
        trimmedEmail &&
        !profile.isEmailVerified &&
        trimmedEmail === existingEmail;

      if (!trimmedEmail) {
        setIsEditingEmail(false);
        setEmail("");
        return;
      }

      if (hasChanged || needsVerification) {
        setPendingUpdate({ field: "email", value: trimmedEmail });
        sendOTP.mutate(
          { email: trimmedEmail },
          {
            onSuccess: () => {
              verificationForm.reset();
              setShowVerificationModal(true);
            },
          }
        );
      } else {
        setIsEditingEmail(false);
        setEmail("");
      }
    } else {
      setEmail(profile.email || "");
      setIsEditingEmail(true);
    }
  };

  const onVerifySubmit = async (data: VerificationFormData) => {
    if (!pendingUpdate) return;

    const updateData: {
      email?: string;
      phone?: string;
      emailOTP?: string;
      phoneOTP?: string;
    } = {};

    if (pendingUpdate.field === "email") {
      updateData.email = pendingUpdate.value;
      updateData.emailOTP = data.emailOTP;
    } else {
      updateData.phone = pendingUpdate.value;
      updateData.phoneOTP = data.phoneOTP;
    }

    updateProfile.mutate(updateData, {
      onSuccess: () => {
        setShowVerificationModal(false);
        setIsEditingEmail(false);
        setIsEditingPhone(false);
        setEmail("");
        setPhone("");
        verificationForm.reset();
        setPendingUpdate(null);
      },
    });
  };

  const handleCancelName = () => {
    setIsEditingName(false);
    setName("");
  };

  const handleCancelEmail = () => {
    setIsEditingEmail(false);
    setEmail("");
  };

  const handleCancelPhone = () => {
    setIsEditingPhone(false);
    setPhone("");
  };

  const formatDateToString = (date: Date): string => {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, "0");
    const day = String(date.getDate()).padStart(2, "0");
    return `${year}-${month}-${day}`;
  };

  const handleEditDateOfBirth = () => {
    if (isEditingDateOfBirth) {
      // Save
      if (dateOfBirth) {
        const newDateStr = formatDateToString(dateOfBirth);
        const today = new Date();

        // Prevent future dates
        if (dateOfBirth > today) {
          toast.error("Date of birth cannot be in the future");
          return;
        }

        const currentDateStr = profile.dateOfBirth
          ? formatDateToString(new Date(profile.dateOfBirth))
          : null;

        if (newDateStr !== currentDateStr) {
          updateProfile.mutate(
            { dateOfBirth: newDateStr },
            {
              onSuccess: () => {
                setIsEditingDateOfBirth(false);
                setDateOfBirth(undefined);
              },
              onError: () => {
                // Keep editing mode on error
              },
            }
          );
        } else {
          setIsEditingDateOfBirth(false);
          setDateOfBirth(undefined);
        }
      } else {
        // No date selected, just cancel
        setIsEditingDateOfBirth(false);
        setDateOfBirth(undefined);
      }
    } else {
      // Start editing
      setDateOfBirth(
        profile.dateOfBirth ? new Date(profile.dateOfBirth) : undefined
      );
      setIsEditingDateOfBirth(true);
    }
  };

  const handleCancelDateOfBirth = () => {
    setIsEditingDateOfBirth(false);
    setDateOfBirth(undefined);
  };

  const handleEditGender = () => {
    if (isEditingGender) {
      // Save
      if (gender && gender !== profile.gender) {
        updateProfile.mutate({
          gender: gender as "male" | "female" | "other" | "prefer-not-to-say",
        });
      }
      setIsEditingGender(false);
      setGender("");
    } else {
      // Start editing
      setGender(profile.gender || "");
      setIsEditingGender(true);
    }
  };

  const handleCancelGender = () => {
    setIsEditingGender(false);
    setGender("");
  };

  // GST validation function
  const validateGstNumber = (gst: string): boolean => {
    if (!gst || gst.trim() === "") return true; // Allow empty GST (optional field)
    const gstPattern =
      /^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z]{1}[1-9A-Z]{1}Z[0-9A-Z]{1}$/;
    return gstPattern.test(gst.trim().toUpperCase());
  };

  const handleEditGst = () => {
    if (isEditingGst) {
      // Save
      const trimmedGst = gstNumber.trim().toUpperCase();

      // If empty, allow clearing GST
      if (trimmedGst === "") {
        if (trimmedGst !== (profile.gstNumber || "")) {
          updateProfile.mutate({ gstNumber: "" });
        }
        setIsEditingGst(false);
        setGstNumber("");
        return;
      }

      // Validate GST format
      if (!validateGstNumber(trimmedGst)) {
        toast.error("Please enter a valid GST number (e.g., 22AAAAA0000A1Z5)");
        return;
      }

      if (trimmedGst !== (profile.gstNumber || "")) {
        updateProfile.mutate({ gstNumber: trimmedGst });
      }
      setIsEditingGst(false);
      setGstNumber("");
    } else {
      // Start editing
      setGstNumber(profile.gstNumber || "");
      setIsEditingGst(true);
    }
  };

  const handleCancelGst = () => {
    setIsEditingGst(false);
    setGstNumber("");
  };

  const renderVerificationBadge = (verified: boolean) => {
    const baseClasses =
      "inline-flex items-center gap-2 rounded-full px-2.5 py-1 text-[11px] font-semibold border";
    const stateClasses = verified
      ? "border-emerald-200 bg-emerald-50 text-emerald-700"
      : "border-amber-200 bg-amber-50 text-amber-700";
    const dotClasses = verified ? "bg-emerald-500" : "bg-amber-500";

    return (
      <Badge variant="outline" className={`${baseClasses} ${stateClasses}`}>
        <span
          className={`h-1.5 w-1.5 rounded-full ${dotClasses}`}
          aria-hidden
        />
        {verified ? "Verified" : "Unverified"}
      </Badge>
    );
  };

  return (
    <div className="space-y-6">
      {/* Profile Card */}
      <Card className="bg-white">
        <CardHeader>
          <CardTitle>Profile Information</CardTitle>
          <CardDescription>
            Your personal details and account information
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center gap-4 mb-6">
            <div className="relative w-24 h-24 rounded-full overflow-hidden shadow-lg ring-2 ring-white">
              {(profile.profilePhoto ||
                profile.avatar ||
                profile.profilePicture) &&
              !avatarError ? (
                <img
                  src={
                    profile.profilePhoto ||
                    profile.avatar ||
                    profile.profilePicture
                  }
                  alt={profile.name || "User"}
                  className="w-full h-full object-cover"
                  onError={() => setAvatarError(true)}
                />
              ) : (
                <div className="w-full h-full bg-gradient-to-br from-slate-900 via-blue-900 to-slate-800 flex items-center justify-center text-white text-3xl font-bold">
                  {profile.name?.charAt(0).toUpperCase() || "U"}
                </div>
              )}
            </div>
            <div className="flex-1">
              <h3 className="text-xl font-bold text-gray-900">
                {profile.name}
              </h3>
              <p className="text-gray-600">{profile.email}</p>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="flex items-center gap-4 p-5 border border-slate-200 rounded-2xl bg-white shadow-sm hover:shadow-md transition-shadow">
              <div className="w-12 h-12 rounded-xl bg-purple-100 flex items-center justify-center flex-shrink-0">
                <User className="w-6 h-6 text-purple-600" />
              </div>
              <div className="flex-1 min-w-0">
                {isEditingName ? (
                  <Input
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    className="h-10"
                    placeholder="Enter name"
                  />
                ) : (
                  <>
                    <p className="text-xs text-gray-500 mb-1 uppercase tracking-wide font-medium">
                      Full Name
                    </p>
                    <p className="text-sm font-semibold text-gray-900 truncate">
                      {profile.name}
                    </p>
                  </>
                )}
              </div>
              {isEditingName ? (
                <div className="flex gap-3 flex-shrink-0">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={handleEditName}
                    disabled={updateProfile.isPending}
                    className="px-2 h-auto text-green-600 hover:text-green-700 hover:bg-transparent"
                  >
                    Save
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={handleCancelName}
                    className="px-2 h-auto text-red-600 hover:text-red-700 hover:bg-transparent"
                  >
                    Cancel
                  </Button>
                </div>
              ) : (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={handleEditName}
                  className="rounded-full"
                >
                  <Edit className="w-4 h-4" />
                </Button>
              )}
            </div>

            <div className="flex items-center gap-4 p-5 border border-slate-200 rounded-2xl bg-white shadow-sm hover:shadow-md transition-shadow">
              <div className="w-12 h-12 rounded-xl bg-blue-100 flex items-center justify-center flex-shrink-0">
                <Mail className="w-6 h-6 text-blue-600" />
              </div>
              <div className="flex-1 min-w-0">
                {isEditingEmail ? (
                  <>
                    <Input
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      className="h-10"
                      placeholder="Enter email"
                      type="email"
                    />
                    <div className="mt-2">
                      {renderVerificationBadge(
                        Boolean(profile.isEmailVerified)
                      )}
                    </div>
                  </>
                ) : (
                  <>
                    <p className="text-xs text-gray-500 mb-1 uppercase tracking-wide font-medium">
                      Email Address
                    </p>
                    <div className="flex items-center gap-2">
                      <p className="text-sm font-semibold text-gray-900 truncate">
                        {profile.email}
                      </p>
                      {renderVerificationBadge(
                        Boolean(profile.isEmailVerified)
                      )}
                    </div>
                  </>
                )}
              </div>
              {isEditingEmail ? (
                <div className="flex gap-3 flex-shrink-0">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={handleEditEmail}
                    disabled={sendOTP.isPending}
                    className="px-2 h-auto text-green-600 hover:text-green-700 hover:bg-transparent"
                  >
                    Verify
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={handleCancelEmail}
                    className="px-2 h-auto text-red-600 hover:text-red-700 hover:bg-transparent"
                  >
                    Cancel
                  </Button>
                </div>
              ) : (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={handleEditEmail}
                  className="rounded-full"
                >
                  <Edit className="w-4 h-4" />
                </Button>
              )}
            </div>

            <div className="flex items-center gap-4 p-5 border border-slate-200 rounded-2xl bg-white shadow-sm hover:shadow-md transition-shadow">
              <div className="w-12 h-12 rounded-xl bg-green-100 flex items-center justify-center flex-shrink-0">
                <Phone className="w-6 h-6 text-green-600" />
              </div>
              <div className="flex-1 min-w-0">
                {isEditingPhone ? (
                  <>
                    <div className="relative">
                      <div className="absolute inset-y-0 left-3 flex items-center pointer-events-none">
                        <span className="text-gray-600 font-medium">+91</span>
                      </div>
                      <Input
                        value={phone}
                        onChange={(e) => setPhone(e.target.value)}
                        className="h-10 pl-14"
                        placeholder="9876543210"
                      />
                    </div>
                    <div className="mt-2">
                      {renderVerificationBadge(
                        Boolean(profile.isPhoneVerified)
                      )}
                    </div>
                  </>
                ) : (
                  <>
                    <p className="text-xs text-gray-500 mb-1 uppercase tracking-wide font-medium">
                      Phone Number
                    </p>
                    <div className="flex items-center gap-2">
                      <p className="text-sm font-semibold text-gray-900 truncate">
                        {profile.phone || (profile.isPhoneVerified ? "Phone verified (update to view)" : "Not set")}
                      </p>
                      {renderVerificationBadge(
                        Boolean(profile.isPhoneVerified)
                      )}
                    </div>
                  </>
                )}
              </div>
              {isEditingPhone ? (
                <div className="flex gap-3 flex-shrink-0">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={handleEditPhone}
                    disabled={sendOTP.isPending}
                    className="px-2 h-auto text-green-600 hover:text-green-700 hover:bg-transparent"
                  >
                    Verify
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={handleCancelPhone}
                    className="px-2 h-auto text-red-600 hover:text-red-700 hover:bg-transparent"
                  >
                    Cancel
                  </Button>
                </div>
              ) : (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={handleEditPhone}
                  className="rounded-full"
                >
                  <Edit className="w-4 h-4" />
                </Button>
              )}
            </div>

            <div className="flex items-start gap-4 p-5 border border-slate-200 rounded-2xl bg-white shadow-sm hover:shadow-md transition-shadow relative">
              <div className="w-12 h-12 rounded-xl bg-orange-100 flex items-center justify-center flex-shrink-0 mt-0.5">
                <Calendar className="w-6 h-6 text-orange-600" />
              </div>
              <div className="flex-1 min-w-0">
                {isEditingDateOfBirth ? (
                  <div className="space-y-2">
                    <DatePicker
                      date={dateOfBirth}
                      onSelect={(date) => {
                        if (date) {
                          // Normalize to local midnight to avoid timezone issues
                          const normalizedDate = new Date(
                            date.getFullYear(),
                            date.getMonth(),
                            date.getDate()
                          );
                          setDateOfBirth(normalizedDate);
                        } else {
                          setDateOfBirth(undefined);
                        }
                      }}
                      placeholder="Select date of birth"
                      maxDate={new Date()}
                    />
                    <div className="flex gap-3 justify-end pt-2">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={handleEditDateOfBirth}
                        disabled={updateProfile.isPending}
                        className="px-2 h-auto text-green-600 hover:text-green-700 hover:bg-transparent"
                      >
                        Save
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={handleCancelDateOfBirth}
                        className="px-2 h-auto text-red-600 hover:text-red-700 hover:bg-transparent"
                      >
                        Cancel
                      </Button>
                    </div>
                  </div>
                ) : (
                  <>
                    <p className="text-xs text-gray-500 mb-1 uppercase tracking-wide font-medium">
                      Date of Birth
                    </p>
                    <p className="text-sm font-semibold text-gray-900 truncate">
                      {profile.dateOfBirth
                        ? new Date(profile.dateOfBirth).toLocaleDateString(
                            "en-US",
                            {
                              year: "numeric",
                              month: "long",
                              day: "numeric",
                            }
                          )
                        : "Not set"}
                    </p>
                  </>
                )}
              </div>
              {!isEditingDateOfBirth && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={handleEditDateOfBirth}
                  className="rounded-full"
                >
                  <Edit className="w-4 h-4" />
                </Button>
              )}
            </div>

            <div className="flex items-center gap-4 p-5 border border-slate-200 rounded-2xl bg-white shadow-sm hover:shadow-md transition-shadow">
              <div className="w-12 h-12 rounded-xl bg-pink-100 flex items-center justify-center flex-shrink-0">
                <User className="w-6 h-6 text-pink-600" />
              </div>
              <div className="flex-1 min-w-0">
                {isEditingGender ? (
                  <Select
                    value={gender}
                    onValueChange={(value) => setGender(value as typeof gender)}
                  >
                    <SelectTrigger className="h-10">
                      <SelectValue placeholder="Select gender" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="male">Male</SelectItem>
                      <SelectItem value="female">Female</SelectItem>
                      <SelectItem value="other">Other</SelectItem>
                      <SelectItem value="prefer-not-to-say">
                        Prefer not to say
                      </SelectItem>
                    </SelectContent>
                  </Select>
                ) : (
                  <>
                    <p className="text-xs text-gray-500 mb-1 uppercase tracking-wide font-medium">
                      Gender
                    </p>
                    <p className="text-sm font-semibold text-gray-900 truncate">
                      {profile.gender
                        ? profile.gender.charAt(0).toUpperCase() +
                          profile.gender.slice(1).replace("-", " ")
                        : "Not set"}
                    </p>
                  </>
                )}
              </div>
              {isEditingGender ? (
                <div className="flex gap-3 flex-shrink-0">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={handleEditGender}
                    disabled={updateProfile.isPending}
                    className="px-2 h-auto text-green-600 hover:text-green-700 hover:bg-transparent"
                  >
                    Save
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={handleCancelGender}
                    className="px-2 h-auto text-red-600 hover:text-red-700 hover:bg-transparent"
                  >
                    Cancel
                  </Button>
                </div>
              ) : (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={handleEditGender}
                  className="rounded-full"
                >
                  <Edit className="w-4 h-4" />
                </Button>
              )}
            </div>

            <div className="flex items-center gap-4 p-5 border border-slate-200 rounded-2xl bg-white shadow-sm hover:shadow-md transition-shadow">
              <div className="w-12 h-12 rounded-xl bg-indigo-100 flex items-center justify-center flex-shrink-0">
                <Receipt className="w-6 h-6 text-indigo-600" />
              </div>
              <div className="flex-1 min-w-0">
                {isEditingGst ? (
                  <div className="space-y-2">
                    <Input
                      value={gstNumber}
                      onChange={(e) =>
                        setGstNumber(e.target.value.toUpperCase())
                      }
                      className="h-10"
                      placeholder="22AAAAA0000A1Z5"
                      maxLength={15}
                    />
                    <p className="text-xs text-gray-500">
                      Format: 15 characters (e.g., 22AAAAA0000A1Z5)
                    </p>
                  </div>
                ) : (
                  <>
                    <p className="text-xs text-gray-500 mb-1 uppercase tracking-wide font-medium">
                      GST Number
                    </p>
                    <p className="text-sm font-semibold text-gray-900 truncate">
                      {profile.gstNumber || "Not set"}
                    </p>
                  </>
                )}
              </div>
              {isEditingGst ? (
                <div className="flex gap-3 flex-shrink-0">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={handleEditGst}
                    disabled={updateProfile.isPending}
                    className="px-2 h-auto text-green-600 hover:text-green-700 hover:bg-transparent"
                  >
                    Save
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={handleCancelGst}
                    className="px-2 h-auto text-red-600 hover:text-red-700 hover:bg-transparent"
                  >
                    Cancel
                  </Button>
                </div>
              ) : (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={handleEditGst}
                  className="rounded-full"
                >
                  <Edit className="w-4 h-4" />
                </Button>
              )}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Verification Modal */}
      <Dialog
        open={showVerificationModal}
        onOpenChange={setShowVerificationModal}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Verify Your Changes</DialogTitle>
            <DialogDescription>
              Enter the OTP sent to your{" "}
              {pendingUpdate?.field === "email" ? "email" : "phone"}
            </DialogDescription>
          </DialogHeader>
          <form
            onSubmit={verificationForm.handleSubmit(onVerifySubmit)}
            className="space-y-6 py-4"
          >
            {pendingUpdate?.field === "email" && (
              <div className="space-y-2">
                <FieldLabel>Email OTP</FieldLabel>
                <Controller
                  name="emailOTP"
                  control={verificationForm.control}
                  rules={{
                    required: "OTP is required",
                    minLength: { value: 6, message: "OTP must be 6 digits" },
                  }}
                  render={({ field }) => (
                    <InputOTP maxLength={6} {...field}>
                      <InputOTPGroup>
                        {[...Array(6)].map((_, index) => (
                          <InputOTPSlot key={index} index={index} />
                        ))}
                      </InputOTPGroup>
                    </InputOTP>
                  )}
                />
                <FieldError
                  errors={[verificationForm.formState.errors.emailOTP]}
                />
                <p className="text-xs text-gray-500 mt-2">
                  Check your email for the OTP
                </p>
              </div>
            )}

            {pendingUpdate?.field === "phone" && (
              <div className="space-y-2">
                <FieldLabel>Phone OTP</FieldLabel>
                <Controller
                  name="phoneOTP"
                  control={verificationForm.control}
                  rules={{
                    required: "OTP is required",
                    minLength: { value: 6, message: "OTP must be 6 digits" },
                  }}
                  render={({ field }) => (
                    <InputOTP maxLength={6} {...field}>
                      <InputOTPGroup>
                        {[...Array(6)].map((_, index) => (
                          <InputOTPSlot key={index} index={index} />
                        ))}
                      </InputOTPGroup>
                    </InputOTP>
                  )}
                />
                <FieldError
                  errors={[verificationForm.formState.errors.phoneOTP]}
                />
                <div className="flex items-center justify-between mt-2">
                  <p className="text-xs text-gray-500">
                    Check your phone for the OTP
                  </p>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => {
                      // Pass the new phone number if user is changing it
                      const phoneToResend = pendingUpdate?.field === "phone" 
                        ? pendingUpdate.value 
                        : undefined;
                      resendPhoneOTP.mutate(phoneToResend, {
                        onSuccess: (data: { message: string; retryAfter?: number }) => {
                          toast.success("OTP resent successfully!");
                          if (data.retryAfter) {
                            setResendCooldown(data.retryAfter);
                          }
                        },
                        onError: (error: any) => {
                          const retryAfter = error?.response?.data?.retryAfter;
                          if (retryAfter) {
                            setResendCooldown(retryAfter);
                            toast.error(
                              `Please wait ${retryAfter} seconds before requesting another OTP`
                            );
                          } else {
                            toast.error(
                              error?.response?.data?.error || "Failed to resend OTP"
                            );
                          }
                        },
                      });
                    }}
                    disabled={resendPhoneOTP.isPending || resendCooldown > 0}
                    className="text-xs h-auto px-2 py-1 text-blue-600 hover:text-blue-700"
                  >
                    {resendCooldown > 0
                      ? `Resend in ${resendCooldown}s`
                      : "Resend OTP"}
                  </Button>
                </div>
              </div>
            )}

            <div className="flex justify-end gap-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => {
                  setShowVerificationModal(false);
                  verificationForm.reset();
                  setPendingUpdate(null);
                }}
              >
                Cancel
              </Button>
              <Button
                type="submit"
                disabled={updateProfile.isPending}
                className="bg-gradient-to-br from-slate-900 via-blue-900 to-slate-800 hover:from-slate-800 hover:via-blue-800 hover:to-slate-700 text-white"
              >
                {updateProfile.isPending ? "Verifying..." : "Verify & Update"}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default PersonalInfo;
