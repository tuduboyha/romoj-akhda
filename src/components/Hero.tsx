import Image from "next/image";

const BASE_PATH = process.env.NEXT_PUBLIC_BASE_PATH ?? "";

export default function Hero() {
  return (
    <div className="flex flex-col items-center px-6 pt-10 text-center sm:pt-14">
      <Image
        src={`${BASE_PATH}/images/romoj-akhra.png`}
        alt="Romoj Akhra"
        width={2381}
        height={1127}
        priority
        className="h-auto w-72 drop-shadow-[0_10px_24px_rgba(0,0,0,0.5)] sm:w-80 md:w-[26rem]"
      />
    </div>
  );
}
