'use client';

import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { CONTACT_INFO } from '@/lib/data';
import Link from 'next/link';
import AnimatedDiv from './animated-div';
import { useToast } from '@/hooks/use-toast';
import { Form, FormControl, FormField, FormItem, FormMessage } from './ui/form';
import { track } from '@/lib/analytics/track';

const contactFormSchema = z.object({
  name: z.string().min(2, { message: 'Name must be at least 2 characters.' }),
  email: z.string().email({ message: 'Please enter a valid email.' }),
  message: z.string().min(10, { message: 'Message must be at least 10 characters.' }),
});

type ContactFormValues = z.infer<typeof contactFormSchema>;

const ContactSection = () => {
  const { toast } = useToast();
  const form = useForm<ContactFormValues>({
    resolver: zodResolver(contactFormSchema),
    defaultValues: {
        name: '',
        email: '',
        message: ''
    }
  });

  const onSubmit = async (data: ContactFormValues) => {
    try {
      const res = await fetch('/api/send-email', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      });
      if (res.ok) {
        track({ type: 'contact_form' });
        toast({
          title: 'Message Sent!',
          description: 'Thanks for reaching out! I will get back to you soon.',
        });
        form.reset();
      } else {
        const err = await res.json();
        toast({
          title: 'Error',
          description: err?.error || 'Something went wrong! Try again later.',
          variant: 'destructive',
        });
      }
    } catch (error) {
      toast({
        title: 'Network Error',
        description: 'Could not send message. Please try again.',
        variant: 'destructive',
      });
    }
  };

  return (
    <section id="contact" className="section-padding bg-primary/10 dark:bg-primary/5">
      <div className="section-container">
        <AnimatedDiv className="text-center mb-12">
          <h2 className="font-headline text-5xl font-bold text-primary tracking-wider md:text-6xl">
            Write to the Hero!
          </h2>
          <p className="mt-4 max-w-2xl mx-auto text-lg text-muted-foreground">
            Have a project or just want to connect? Drop a line!
          </p>
        </AnimatedDiv>
        <div className="grid md:grid-cols-2 gap-12 max-w-6xl mx-auto">
          <AnimatedDiv delay={100} className="relative bg-background p-8 rounded-lg border-4 border-foreground shadow-lg">
             <div className="absolute -top-5 -left-5 bg-accent text-accent-foreground px-4 py-1.5 rounded-lg border-2 border-foreground transform -rotate-6">
                <h3 className="font-headline text-2xl tracking-wider">Send a Message</h3>
            </div>
            <Form {...form}>
                <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4 mt-8">
                    <FormField control={form.control} name="name"
                        render={({ field }) => (
                            <FormItem>
                            <FormControl>
                                <Input placeholder="Your Name" {...field} className="border-2 border-foreground" />
                            </FormControl>
                            <FormMessage />
                            </FormItem>
                        )}
                    />
                    <FormField control={form.control} name="email"
                        render={({ field }) => (
                            <FormItem>
                            <FormControl>
                                <Input placeholder="Your Email" {...field} className="border-2 border-foreground" />
                            </FormControl>
                            <FormMessage />
                            </FormItem>
                        )}
                    />
                    <FormField control={form.control} name="message"
                        render={({ field }) => (
                            <FormItem>
                            <FormControl>
                                <Textarea placeholder="Your message..." className="min-h-32 border-2 border-foreground" {...field} />
                            </FormControl>
                            <FormMessage />
                            </FormItem>
                        )}
                    />
                  <Button type="submit" className="w-full font-headline text-xl tracking-wider border-2 border-foreground shadow-md" disabled={form.formState.isSubmitting}>
                    {form.formState.isSubmitting ? 'Sending...' : 'SEND!'}
                  </Button>
                </form>
            </Form>
          </AnimatedDiv>
          <div className='space-y-6'>
              {CONTACT_INFO.map((info, index) => (
                  <AnimatedDiv key={info.name} delay={index * 100 + 200}>
                      <Link href={info.href} target="_blank" className="flex items-center gap-4 group">
                         <div className="bg-accent/20 p-3 rounded-lg border-2 border-foreground group-hover:bg-accent transition-colors">
                          <info.icon 
                            className="h-8 w-8"
                            style={{ color: info.color || undefined }}
                          />
                        </div>
                        <div>
                          <p className="font-bold text-xl">{info.name}</p>
                          <p className="text-base text-muted-foreground group-hover:text-primary transition-colors">{info.value}</p>
                        </div>
                      </Link>
                  </AnimatedDiv>
              ))}
          </div>
        </div>
      </div>
    </section>
  );
};

export default ContactSection;
