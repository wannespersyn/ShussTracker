export const EuroIcon = ({ className, style }: { className?: string; style?: React.CSSProperties }) => {
    return (
        <svg
            xmlns="http://www.w3.org/2000/svg"
            width="24"
            height="24"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            className={className}
            style={style}>
            <path d="M15.5 7.5a5 5 0 1 0 0 9M6.5 11h6M6.5 13.5h6"/>
        </svg>
    );
};
