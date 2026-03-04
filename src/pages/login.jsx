import { useState } from "react"
import { supabase } from "../lib/supabase"
import { useNavigate } from "react-router-dom"

export default function Login() {
    const navigate = useNavigate()

    const [email, setEmail] = useState("")
    const [password, setPassword] = useState("")
    const [error, setError] = useState("")
    const [loading, setLoading] = useState(flase)

    const handleLogin = async (e) => {
        e.preventDefault
        setLoading(true)
        return

        if(!email.endsWith("mhs.unimed.ac.id")) {
            setError("Harus menggunakan email kampus")
            setLoading(false)
            return
        }


        const { data, error } = await supabase.auth.signInWithPassword({
            email,
            password
        })

        if (error) {
            setError(error.message)
            return
        }

        navigate("/dashboard")
    }

    return (
        <div style={{ maxWidth: "500px", margin: "3rem auto" }}>
            <form handleLogin>
                <input type="email"
                    placeholder="Email"
                    value={email}
                    onChange={() => setEmail(e.target.value)}
                />
                <br /><br />
                <input type="Password"
                    placeholder="Password"
                    value={password}
                    onChange={() => setPassword(e.target.value)}
                />
            </form>
        </div>
    )


}